"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { socket } from "@/shared/socket";
import { getSlotFromPosition } from "@/lib/room";
import { debugLog } from "../components/DebugOverlay";

const ACTIVE_TAB_KEY = "dart.activeTabId";
const QUEUE_TIMEOUT_MS = 2 * 60 * 1000;

interface UseQueueProps {
  room: string;
  name: string;
  isInGame: boolean;
  onEnterGame: (slot: 1 | 2) => void;
}

interface UseQueueReturn {
  isInQueue: boolean;
  queuePosition: number | null;
  queueSnapshot: string[] | null;
  joinedQueueRef: React.MutableRefObject<boolean>;
  setIsInQueue: React.Dispatch<React.SetStateAction<boolean>>;
  leaveQueue: () => void;
  connectAndJoinQueue: () => void;
}

// 대기열 관리 hook
export function useQueue({
  room,
  name,
  isInGame,
  onEnterGame,
}: UseQueueProps): UseQueueReturn {
  const [isInQueue, setIsInQueue] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueSnapshot, setQueueSnapshot] = useState<string[] | null>(null);
  const joinedQueueRef = useRef(false);
  const lastRejoinAtRef = useRef(0);
  const tabIdRef = useRef("");
  const queueStartAtRef = useRef<number | null>(null);
  const hasActiveTabRef = useRef(true);

  const leaveQueue = useCallback(() => {
    if (joinedQueueRef.current) {
      debugLog("[Queue] leave-queue emit");
      socket.emit("leave-queue");
      joinedQueueRef.current = false;
    }
    setIsInQueue(false);
    setQueuePosition(null);
    setQueueSnapshot(null);
    queueStartAtRef.current = null;
  }, []);

  const connectAndJoinQueue = useCallback(() => {
    if (!hasActiveTabRef.current) {
      debugLog("[Queue] 다른 탭이 활성화됨 - join-queue 차단");
      return;
    }
    if (!socket.connected) {
      debugLog("[Socket] 연결 시도...");
      socket.io.opts.query = { room, name };
      socket.connect();
    }
    setIsInQueue(true);
    queueStartAtRef.current = Date.now();
  }, [room, name]);

  // 대기열 소켓 이벤트 처리
  useEffect(() => {
    if (!isInQueue || isInGame) return;

    debugLog(`[Queue] 대기열 모드, socket: ${socket.connected}`);

    if (!socket.connected) {
      socket.io.opts.query = { room, name };
      socket.connect();
    }

    const findMyPosition = (queue: string[]): number => {
      if (!socket.id) return -1;
      const idx = queue.indexOf(socket.id);
      return idx >= 0 ? idx : -1;
    };

    const onStatusQueue = (queue: string[]) => {
      debugLog(`[Queue] status-queue: ${JSON.stringify(queue)}`);
      setQueueSnapshot(queue);

      const position = findMyPosition(queue);
      debugLog(`[Queue] 내 위치: ${position}`);
      setQueuePosition(position);

      if (position < 0 && joinedQueueRef.current) {
        const now = Date.now();
        if (now - lastRejoinAtRef.current > 5000) {
          lastRejoinAtRef.current = now;
          debugLog("[Queue] 내 소켓이 큐에 없음 - 재진입 시도");
          socket.emit("leave-queue");
          socket.emit("join-queue");
          joinedQueueRef.current = true;
        }
      }

      const slot = getSlotFromPosition(position);
      if (slot && !isInGame) {
        debugLog(`[Queue] 입장 가능! 슬롯: ${slot}`);
        onEnterGame(slot);
      }
    };

    const onConnect = () => {
      debugLog("[Socket] connected (queue mode)");
      debugLog("[Queue] re-sync join-queue");
      socket.emit("leave-queue");
      socket.emit("join-queue");
      joinedQueueRef.current = true;
      debugLog("[Queue] status-queue 요청");
      socket.emit("status-queue");
    };

    const onConnectError = (err: unknown) => {
      debugLog(`[Socket] connect_error: ${String(err)}`);
    };

    const onError = (err: unknown) => {
      debugLog(`[Socket] error: ${String(err)}`);
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("error", onError);
    socket.on("status-queue", onStatusQueue);

    const heartbeatId = window.setInterval(() => {
      if (!socket.connected || !joinedQueueRef.current) return;
      debugLog("[Queue] heartbeat status-queue");
      socket.emit("status-queue");
    }, 8000);

    const timeoutId = window.setInterval(() => {
      if (!joinedQueueRef.current || !queueStartAtRef.current) return;
      const elapsed = Date.now() - queueStartAtRef.current;
      if (elapsed >= QUEUE_TIMEOUT_MS) {
        debugLog("[Queue] 대기열 타임아웃 - 자동 이탈");
        leaveQueue();
      }
    }, 5000);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      window.clearInterval(heartbeatId);
      window.clearInterval(timeoutId);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("error", onError);
      socket.off("status-queue", onStatusQueue);
    };
  }, [isInQueue, isInGame, name, onEnterGame, room]);

  useEffect(() => {
    const existing = localStorage.getItem(ACTIVE_TAB_KEY);
    if (!existing) {
      const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(ACTIVE_TAB_KEY, newId);
      tabIdRef.current = newId;
      hasActiveTabRef.current = true;
    } else {
      tabIdRef.current = existing;
      hasActiveTabRef.current = true;
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== ACTIVE_TAB_KEY) return;
      if (!event.newValue) {
        const newId = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        localStorage.setItem(ACTIVE_TAB_KEY, newId);
        tabIdRef.current = newId;
        hasActiveTabRef.current = true;
        return;
      }

      if (event.newValue !== tabIdRef.current) {
        hasActiveTabRef.current = false;
        if (joinedQueueRef.current) {
          debugLog("[Queue] 다른 탭 활성 - 자동 이탈");
          leaveQueue();
        }
      }
    };

    const onBeforeUnload = () => {
      if (localStorage.getItem(ACTIVE_TAB_KEY) === tabIdRef.current) {
        localStorage.removeItem(ACTIVE_TAB_KEY);
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (localStorage.getItem(ACTIVE_TAB_KEY) === tabIdRef.current) {
        localStorage.removeItem(ACTIVE_TAB_KEY);
      }
    };
  }, [leaveQueue]);

  return {
    isInQueue,
    queuePosition,
    queueSnapshot,
    joinedQueueRef,
    setIsInQueue,
    leaveQueue,
    connectAndJoinQueue,
  };
}
