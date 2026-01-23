"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { socket } from "@/shared/socket";
import { getSlotFromPosition } from "@/lib/room";
import { debugLog } from "../components/DebugOverlay";

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

  const leaveQueue = useCallback(() => {
    if (joinedQueueRef.current) {
      debugLog("[Queue] leave-queue emit");
      socket.emit("leave-queue");
      joinedQueueRef.current = false;
    }
    setIsInQueue(false);
    setQueuePosition(null);
    setQueueSnapshot(null);
  }, []);

  const connectAndJoinQueue = useCallback(() => {
    if (!socket.connected) {
      debugLog("[Socket] 연결 시도...");
      socket.io.opts.query = { room, name };
      socket.connect();
    }
    setIsInQueue(true);
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

      const slot = getSlotFromPosition(position);
      if (slot && !isInGame) {
        debugLog(`[Queue] 입장 가능! 슬롯: ${slot}`);
        onEnterGame(slot);
      }
    };

    const onConnect = () => {
      debugLog("[Socket] connected (queue mode)");
      if (!joinedQueueRef.current) {
        debugLog("[Queue] join-queue emit");
        socket.emit("join-queue");
        joinedQueueRef.current = true;
      }
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

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("error", onError);
      socket.off("status-queue", onStatusQueue);
    };
  }, [isInQueue, isInGame, name, onEnterGame, room]);

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
