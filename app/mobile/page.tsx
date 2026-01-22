"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { socket } from "@/shared/socket";
import { useMobileSocket } from "@/hooks/useMobileSocket";
import { useGyroscope } from "@/hooks/useGyroscope";
import { getQRSession } from "@/lib/session";
import { getRoomFromUrl } from "@/lib/room";
import SessionValidating from "./components/SessionValidating";
import AccessDenied from "./components/AccessDenied";
import NameInput from "./components/NameInput";
import GameScreen from "./components/GameScreen";
import ResultScreen from "./components/ResultScreen";
import WaitingScreen from "./components/WaitingScreen";
import DebugOverlay, { debugLog } from "./components/DebugOverlay";

export default function MobilePage() {
  const [sessionValid] = useState<boolean | null>(() =>
    getQRSession() !== null ? true : false
  );
  const [room] = useState(getRoomFromUrl);
  const [customName, setCustomName] = useState("");
  const [isInGame, setIsInGame] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [assignedSlot, setAssignedSlot] = useState<1 | 2 | null>(null);
  const [isInQueue, setIsInQueue] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueSnapshot, setQueueSnapshot] = useState<string[] | null>(null);
  const joinedQueueRef = useRef(false);
  const motionPermissionRef = useRef(false);

  const { emitAimUpdate, emitAimOff, emitThrowDart, leaveGame } = useMobileSocket({
    room,
    name: customName,
    enabled: hasJoined,
    slot: assignedSlot,
  });

  const {
    aimPosition,
    sensorsReady,
    sensorError,
    throwsLeft,
    hasFinishedTurn,
    myScore,
    startSensors,
    stopSensors,
    requestMotionPermission,
    setHasFinishedTurn,
  } = useGyroscope({
    emitAimUpdate,
    emitAimOff,
    emitThrowDart,
  });

  useEffect(() => {
    return () => stopSensors();
  }, [stopSensors]);

  useEffect(() => {
    const emitLeaveQueue = () => {
      if (!joinedQueueRef.current) return;
      debugLog("[Queue] leave-queue emit (page hide)");
      socket.emit("leave-queue");
      joinedQueueRef.current = false;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        emitLeaveQueue();
      }
    };

    window.addEventListener("pagehide", emitLeaveQueue);
    window.addEventListener("beforeunload", emitLeaveQueue);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (joinedQueueRef.current) {
        debugLog("[Queue] leave-queue emit (unmount)");
        socket.emit("leave-queue");
        joinedQueueRef.current = false;
      }
      window.removeEventListener("pagehide", emitLeaveQueue);
      window.removeEventListener("beforeunload", emitLeaveQueue);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // throwsLeft가 0이 되면 결과 화면으로 전환
  useEffect(() => {
    if (isInGame && throwsLeft === 0 && !hasFinishedTurn) {
      setHasFinishedTurn(true);
    }
  }, [isInGame, throwsLeft, hasFinishedTurn, setHasFinishedTurn]);

  // 대기열에서 내 위치에 따라 슬롯 결정
  const getSlotFromPosition = (position: number): 1 | 2 | null => {
    if (position === 0) return 1;
    if (position === 1) return 2;
    return null;
  };

  // 게임 입장
  const enterGame = useCallback((slot: 1 | 2) => {
    debugLog(`✅ 게임 입장, 슬롯: ${slot}`);
    setAssignedSlot(slot);
    setHasJoined(true);
    setIsInGame(true);
    startSensors();
  }, [startSensors]);

  // 대기열 나가기
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

  // 시작 버튼 클릭 - 무조건 대기열 먼저
  const handleStart = async () => {
    debugLog("=== handleStart ===");
    setHasFinishedTurn(false);

    // 모션 권한 먼저 확보
    if (!motionPermissionRef.current) {
      try {
        const hasPermission = await requestMotionPermission();
        debugLog(`motion permission: ${hasPermission}`);
        if (!hasPermission) return;
        motionPermissionRef.current = true;
      } catch (error) {
        debugLog(`motion permission error: ${error}`);
        return;
      }
    }

    // 소켓 연결
    if (!socket.connected) {
      debugLog("[Socket] 연결 시도...");
      socket.io.opts.query = { room, name: customName };
      socket.connect();
    }

    // 대기열 참가
    setIsInQueue(true);
  };

  // 게임 종료 (결과 화면에서 나가기)
  const handleExit = () => {
    debugLog("=== handleExit ===");
    setHasFinishedTurn(false);
    setCustomName("");
    setAssignedSlot(null);
    setIsInGame(false);
    setHasJoined(false);
    leaveQueue();
    leaveGame();
    stopSensors();
  };

  const handleRequestPermission = useCallback(async () => {
    try {
      const ok = await requestMotionPermission();
      if (ok) {
        motionPermissionRef.current = true;
        startSensors();
      }
    } catch (error) {
      debugLog(`permission error: ${error}`);
    }
  }, [requestMotionPermission, startSensors]);

  // 대기열 로직 (게임 입장 전)
  useEffect(() => {
    if (!isInQueue || isInGame) return;

    debugLog(`[Queue] 대기열 모드, socket: ${socket.connected}`);

    if (!socket.connected) {
      socket.io.opts.query = { room, name: customName };
      socket.connect();
    }

    // 대기열에서 내 위치 찾기
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

      // 위치 0, 1이면 게임 입장 가능
      const slot = getSlotFromPosition(position);
      if (slot && !isInGame) {
        debugLog(`[Queue] 입장 가능! 슬롯: ${slot}`);
        enterGame(slot);
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

    return () => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("error", onError);
      socket.off("status-queue", onStatusQueue);
    };
  }, [isInQueue, isInGame, customName, enterGame]);

  // 게임 종료 시 대기열에서 제거
  useEffect(() => {
    if (!hasFinishedTurn || !isInQueue) return;
    leaveQueue();
  }, [hasFinishedTurn, isInQueue, leaveQueue]);

  // 대기 중인지 여부 (대기열에 있지만 아직 게임 안 함)
  const isWaitingInQueue =
    isInQueue && !isInGame && queuePosition !== null && queuePosition >= 2;

  // 렌더링 상태 로그 (너무 많아서 주석처리)
  // debugLog(`[Render] inQueue=${isInQueue} pos=${queuePosition} inGame=${isInGame}`);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-[#1e3c72] to-[#2a5298] px-5">
      <DebugOverlay />
      {sessionValid === null && <SessionValidating />}
      {sessionValid === false && <AccessDenied />}

      {/* 대기 화면: 대기열 3번째(index 2) 이상 */}
      {sessionValid === true && isWaitingInQueue && (
        <WaitingScreen
          aheadCount={queuePosition !== null ? queuePosition : null}
          queue={queueSnapshot}
        />
      )}

      {/* 결과 화면 */}
      {sessionValid === true && hasFinishedTurn && (
        <ResultScreen name={customName} score={myScore} onExit={handleExit} />
      )}

      {/* 게임 화면 */}
      {sessionValid === true && !hasFinishedTurn && isInGame && (
        <GameScreen
          aimPosition={aimPosition}
          throwsLeft={throwsLeft}
          sensorsReady={sensorsReady}
          sensorError={sensorError}
          onRequestPermission={handleRequestPermission}
        />
      )}

      {/* 이름 입력 화면 */}
      {sessionValid === true && !isInQueue && !hasFinishedTurn && !isInGame && (
        <NameInput
          name={customName}
          onNameChange={setCustomName}
          onStart={handleStart}
        />
      )}

      {/* 대기열 진입 중 (위치 확인 전) */}
      {sessionValid === true && isInQueue && !isInGame && queuePosition === null && (
        <div className="text-white text-center">
          <div className="text-xl mb-2">대기열 확인 중...</div>
        </div>
      )}
    </div>
  );
}
