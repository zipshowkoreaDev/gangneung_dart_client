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

export default function MobilePage() {
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [room] = useState(getRoomFromUrl);
  const [customName, setCustomName] = useState("");
  const [isInGame, setIsInGame] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    setSessionValid(getQRSession() !== null);
  }, []);

  const { emitAimUpdate, emitAimOff, emitThrowDart } = useMobileSocket({
    room,
    name: customName,
    enabled: hasJoined,
  });

  const {
    aimPosition,
    sensorsReady,
    sensorError,
    throwsLeft,
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

  const handleStart = async () => {
    setHasFinishedTurn(false);

    const hasPermission = await requestMotionPermission();
    if (!hasPermission) return;

    setHasJoined(true);
    setIsInGame(true);
    startSensors();
  };

  const handleRequestPermission = useCallback(async () => {
    const ok = await requestMotionPermission();
    if (ok) startSensors();
  }, [requestMotionPermission, startSensors]);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-[#1e3c72] to-[#2a5298] px-5">
      {sessionValid === null && <SessionValidating />}
      {sessionValid === false && <AccessDenied />}
      {sessionValid === true && (
        isInGame ? (
          <GameScreen
            aimPosition={aimPosition}
            throwsLeft={throwsLeft}
            sensorsReady={sensorsReady}
            sensorError={sensorError}
            onRequestPermission={handleRequestPermission}
          />
        ) : (
          <NameInput
            name={customName}
            onNameChange={setCustomName}
            onStart={handleStart}
          />
        )
      )}
    </div>
  );
}
