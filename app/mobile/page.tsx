"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { socket } from "@/shared/socket";
import { useMobileSocket } from "@/hooks/useMobileSocket";
import { useGyroscope } from "@/hooks/useGyroscope";
import { getQRSession } from "@/lib/session";
import { getRoomFromUrl } from "@/lib/room";
import { useQueue } from "./hooks/useQueue";
import { useAimTimeout } from "./hooks/useAimTimeout";
import { usePageLeave } from "./hooks/usePageLeave";
import useProfanityCheck from "@/hooks/useProfanityCheck";
import SessionValidating from "./components/SessionValidating";
import AccessDenied from "./components/AccessDenied";
import NameInput from "./components/NameInput";
import GameScreen from "./components/GameScreen";
import ResultScreen from "./components/ResultScreen";
import WaitingScreen from "./components/WaitingScreen";
import QueueLoading from "./components/QueueLoading";
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
  const motionPermissionRef = useRef(false);
  const startAimTimeoutRef = useRef<() => void>(() => {});
  const { validateInput } = useProfanityCheck();

  const { emitAimUpdate, emitAimOff, emitThrowDart, leaveGame } = useMobileSocket({
    room,
    name: customName,
    enabled: hasJoined,
    slot: assignedSlot,
  });

  const emitAimUpdateWithTimeout = useCallback(
    (aim: { x: number; y: number }, skin?: string) => {
      startAimTimeoutRef.current();
      emitAimUpdate(aim, skin);
    },
    [emitAimUpdate]
  );

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
    emitAimUpdate: emitAimUpdateWithTimeout,
    emitAimOff,
    emitThrowDart,
  });

  const handleEnterGame = useCallback((slot: 1 | 2) => {
    debugLog(`✅ 게임 입장, 슬롯: ${slot}`);
    setAssignedSlot(slot);
    setHasJoined(true);
    setIsInGame(true);
    startSensors();
    startAimTimeoutRef.current();
  }, [startSensors]);

  const {
    isInQueue,
    queuePosition,
    queueSnapshot,
    joinedQueueRef,
    setIsInQueue,
    leaveQueue,
    connectAndJoinQueue,
  } = useQueue({
    room,
    name: customName,
    isInGame,
    onEnterGame: handleEnterGame,
  });

  const handleAimTimeout = useCallback(() => {
    if (joinedQueueRef.current) {
      socket.emit("leave-queue");
      joinedQueueRef.current = false;
    }
    setIsInQueue(false);
    setAssignedSlot(null);
    setHasJoined(false);
    setIsInGame(false);
    setHasFinishedTurn(false);
    leaveGame();
    stopSensors();
  }, [joinedQueueRef, setIsInQueue, setHasFinishedTurn, leaveGame, stopSensors]);

  const { startAimTimeout } = useAimTimeout({
    isInGame,
    hasFinishedTurn,
    onTimeout: handleAimTimeout,
  });

  useEffect(() => {
    startAimTimeoutRef.current = startAimTimeout;
  }, [startAimTimeout]);

  usePageLeave({ joinedQueueRef });

  useEffect(() => {
    return () => stopSensors();
  }, [stopSensors]);

  // 3회 던지기 완료 시 결과 화면 전환
  useEffect(() => {
    if (isInGame && throwsLeft === 0 && !hasFinishedTurn) {
      setHasFinishedTurn(true);
    }
  }, [isInGame, throwsLeft, hasFinishedTurn, setHasFinishedTurn]);

  // 게임 종료 시 대기열 이탈
  useEffect(() => {
    if (!hasFinishedTurn || !isInQueue) return;
    const timer = setTimeout(() => {
      leaveQueue();
    }, 0);
    return () => clearTimeout(timer);
  }, [hasFinishedTurn, isInQueue, leaveQueue]);

  const handleStart = async () => {
    debugLog("=== handleStart ===");
    setHasFinishedTurn(false);

    const validation = validateInput(customName);
    if (!validation.isValid) return;

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

    connectAndJoinQueue();
  };

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

  const isWaitingInQueue =
    isInQueue && !isInGame && queuePosition !== null && queuePosition >= 2;
  const nameValidation = validateInput(customName);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-[#1e3c72] to-[#2a5298] px-5">
      <DebugOverlay />
      {sessionValid === null && <SessionValidating />}
      {sessionValid === false && <AccessDenied />}

      {sessionValid === true && isWaitingInQueue && (
        <WaitingScreen
          aheadCount={queuePosition !== null ? Math.max(0, queuePosition - 2) : null}
          queue={queueSnapshot}
        />
      )}

      {sessionValid === true && hasFinishedTurn && (
        <ResultScreen name={customName} score={myScore} onExit={handleExit} />
      )}

      {sessionValid === true && !hasFinishedTurn && isInGame && (
        <GameScreen
          aimPosition={aimPosition}
          throwsLeft={throwsLeft}
          sensorsReady={sensorsReady}
          sensorError={sensorError}
          onRequestPermission={handleRequestPermission}
        />
      )}

      {sessionValid === true && !isInQueue && !hasFinishedTurn && !isInGame && (
        <NameInput
          name={customName}
          onNameChange={setCustomName}
          onStart={handleStart}
          errorMessage={
            customName.trim() && !nameValidation.isValid
              ? nameValidation.message
              : ""
          }
        />
      )}

      {sessionValid === true && isInQueue && !isInGame && queuePosition === null && (
        <QueueLoading />
      )}
    </div>
  );
}
