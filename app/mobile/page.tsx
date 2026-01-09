"use client";

import { useEffect, useState, useCallback } from "react";
import { useMobileSocket } from "@/hooks/useMobileSocket";
import { useGyroscope } from "@/hooks/useGyroscope";

export default function MobilePage() {
  const [room] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const roomFromUrl = urlParams.get("room");
      return roomFromUrl || "zipshow";
    }
    return "zipshow";
  });
  const [customName, setCustomName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isInGame, setIsInGame] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

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
    setNameError("");
    setHasFinishedTurn(false);

    // 먼저 자이로센서 권한 요청 (UI 변경 전에)
    const hasPermission = await requestMotionPermission();
    if (!hasPermission) {
      return;
    }

    // 권한 승인 후 상태 변경 및 센서 시작 (사용자 제스처 컨텍스트 내)
    setHasJoined(true);
    setIsInGame(true);
    startSensors();
  };

  const handleRequestPermission = useCallback(async () => {
    const ok = await requestMotionPermission();
    if (ok) {
      startSensors();
    }
  }, [requestMotionPermission, startSensors]);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-[#1e3c72] to-[#2a5298] px-5">
      {isInGame ? (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white text-lg font-bold text-center">
            <div>다트 게임</div>
          </div>

          {/* 자이로 조준 패드 */}
          <div className="w-[90%] max-w-[500px] h-[60vh] bg-white/10 rounded-3xl border-[3px] border-white/30 relative backdrop-blur-[10px]">
            <div
              className="absolute top-1/2 left-1/2 w-[60px] h-[60px] rounded-full border-4 border-[#FFD700] bg-[#FFD700]/30 pointer-events-none transition-transform duration-[50ms] ease-out"
              style={{
                transform: `translate(calc(-50% + ${
                  aimPosition.x * 45
                }%), calc(-50% + ${aimPosition.y * 45}%))`,
              }}
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-sm opacity-50 pointer-events-none">
              휴대폰을 기울여 조준하세요
            </div>
          </div>

          <div className="mt-5 text-white text-xs opacity-60">
            X: {aimPosition.x.toFixed(2)}, Y: {aimPosition.y.toFixed(2)}
          </div>
          <div className="mt-2 text-white text-sm opacity-80 tracking-[6px]">
            {Array.from({ length: 3 }).map((_, index) => (
              <span
                key={index}
                className={index < throwsLeft ? "opacity-100" : "opacity-20"}
              >
                O
              </span>
            ))}
          </div>

          {!sensorsReady && (
            <button
              onClick={handleRequestPermission}
              className="mt-3 px-5 py-3 text-sm font-semibold rounded-full border-none bg-white/20 text-white cursor-pointer"
            >
              자이로 권한 다시 요청
            </button>
          )}

          {sensorError && (
            <div className="mt-2.5 text-[#ffdddd] text-xs opacity-80">
              {sensorError}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8">
          <div className="text-[28px] font-bold text-white text-center">
            다트 게임
          </div>

          <div className="flex flex-col items-center gap-4 w-full max-w-[320px]">
            <input
              type="text"
              value={customName}
              onChange={(e) => {
                setCustomName(e.target.value);
                setNameError("");
              }}
              placeholder="이름 입력 (5글자 이내)"
              maxLength={5}
              className="w-full py-4 px-5 text-lg text-center rounded-xl border-2 border-white/30 bg-white/10 text-white placeholder-white/50 backdrop-blur-sm focus:outline-none focus:border-white/50"
            />
            {nameError && (
              <div className="text-[#ff6b6b] text-sm font-medium">
                {nameError}
              </div>
            )}
          </div>

          <button
            onClick={handleStart}
            disabled={!customName.trim()}
            className="py-5 px-10 text-2xl font-bold rounded-2xl border-none bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-black shadow-[0_8px_32px_rgba(255,215,0,0.4)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
          >
            시작하기
          </button>
        </div>
      )}
    </div>
  );
}




