"use client";

import { useEffect, useState, useCallback } from "react";
import { useMobileSocket } from "@/hooks/useMobileSocket";
import { useGyroscope } from "@/hooks/useGyroscope";
import { getQRSession } from "@/lib/session";
import { getRoomFromUrl } from "@/lib/room";
import SessionValidating from "./components/SessionValidating";
import AccessDenied from "./components/AccessDenied";
import NameInput from "./components/NameInput";
import GameScreen from "./components/GameScreen";
import ResultScreen from "./components/ResultScreen";

export default function MobilePage() {
  const [sessionValid] = useState<boolean | null>(() =>
    getQRSession() !== null ? true : false
  );
  const [room] = useState(getRoomFromUrl);
  const [customName, setCustomName] = useState("");
  const [isInGame, setIsInGame] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [assignedSlot, setAssignedSlot] = useState<1 | 2 | null>(null);

  const { emitAimUpdate, emitAimOff, emitThrowDart, leaveGame } = useMobileSocket({
    room,
    name: customName,
    enabled: hasJoined,
    slot: assignedSlot,
    onSlotAssigned: (slot) => {
      setAssignedSlot(slot);
      console.log(`Assigned to slot ${slot}`);
    },
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

  // throwsLeft가 0이 되면 결과 화면으로 전환
  useEffect(() => {
    if (isInGame && throwsLeft === 0 && !hasFinishedTurn) {
      setHasFinishedTurn(true);
    }
  }, [isInGame, throwsLeft, hasFinishedTurn, setHasFinishedTurn]);

  const ensureMotionPermission = useCallback(async () => {
    try {
      return await requestMotionPermission();
    } catch (error) {
      console.error("Motion permission failed", error);
      return false;
    }
  }, [requestMotionPermission]);

  const handleStart = async () => {
    setHasFinishedTurn(false);

    const hasPermission = await ensureMotionPermission();
    if (!hasPermission) return;

    setHasJoined(true);
    setIsInGame(true);
    startSensors();
  };

  const handleRequestPermission = useCallback(async () => {
    const ok = await ensureMotionPermission();
    if (ok) startSensors();
  }, [ensureMotionPermission, startSensors]);

  const handleExit = () => {
    setHasFinishedTurn(false);
    setCustomName("");
    setAssignedSlot(null);
    setIsInGame(false);
    setHasJoined(false);
    leaveGame();
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-[#1e3c72] to-[#2a5298] px-5">
      {sessionValid === null && <SessionValidating />}
      {sessionValid === false && <AccessDenied />}
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
      {sessionValid === true && !hasFinishedTurn && !isInGame && (
        <NameInput
          name={customName}
          onNameChange={setCustomName}
          onStart={handleStart}
        />
      )}
    </div>
  );
}
