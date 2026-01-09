"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useMobileSocket } from "@/hooks/useMobileSocket";
import { useGyroscope } from "@/hooks/useGyroscope";
import { useGameMode } from "@/hooks/useGameMode";
import { useSimpleCountdown } from "@/hooks/useSimpleCountdown";
import ModeSelection from "./components/ModeSelection";
import ModeWaiting from "./components/ModeWaiting";
import GameScreen from "./components/GameScreen";

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
  const [playerCount, setPlayerCount] = useState(0);
  const [selectedMode, setSelectedMode] = useState<"solo" | "duo" | null>(null);
  const [nameError, setNameError] = useState("");
  const [isInGame, setIsInGame] = useState(false);
  const [isWaitingForDuo, setIsWaitingForDuo] = useState(false);
  const [otherPlayerActive, setOtherPlayerActive] = useState(false);
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // 이름이 있으면 바로 소켓 연결
  const shouldConnect = customName.length > 0;

  // setHasFinishedTurn ref (useGyroscope에서 받아올 함수를 저장)
  const setHasFinishedTurnRef = useRef<((value: boolean) => void) | null>(null);

  // 플레이어 수 변경 핸들러
  const handlePlayerCountChange = useCallback(
    (count: number) => {
      setPlayerCount(count);

      // Duo 모드 대기 중이고 2명이 되면 카운트다운 시작
      if (selectedMode === "duo" && isWaitingForDuo && count === 2) {
        setIsWaitingForDuo(false);
        setCountdown(5);
      }
    },
    [selectedMode, isWaitingForDuo]
  );

  // 턴 업데이트 핸들러
  const handleTurnUpdate = useCallback(
    (turn: string | null) => {
      setCurrentTurn(turn);

      // 내 턴이 되면 finished 상태 리셋
      if (customName && turn === customName && setHasFinishedTurnRef.current) {
        setHasFinishedTurnRef.current(false);
      }
    },
    [customName]
  );

  const { emitAimUpdate, emitAimOff, emitThrowDart, emitSelectMode } =
    useMobileSocket({
      room: shouldConnect ? room : "",
      customName,
      selectedMode,
      onPlayerCountChange: handlePlayerCountChange,
      onOtherPlayerActive: setOtherPlayerActive,
      onTurnUpdate: handleTurnUpdate,
    });

  const {
    aimPosition,
    sensorsReady,
    sensorError,
    throwsLeft,
    hasFinishedTurn,
    startSensors,
    stopSensors,
    requestMotionPermission,
    setHasFinishedTurn,
  } = useGyroscope({
    selectedMode,
    currentTurn,
    customName,
    emitAimUpdate,
    emitAimOff,
    emitThrowDart,
  });

  // setHasFinishedTurn을 ref에 저장
  useEffect(() => {
    setHasFinishedTurnRef.current = setHasFinishedTurn;
  }, [setHasFinishedTurn]);

  useEffect(() => {
    return () => stopSensors();
  }, [stopSensors]);

  // 카운트다운 완료 시 게임 시작
  const handleCountdownComplete = useCallback(() => {
    setIsInGame(true);
    startSensors();
    emitAimUpdate({ x: 0, y: 0 });
  }, [startSensors, emitAimUpdate]);

  useSimpleCountdown({
    countdown,
    setCountdown,
    onComplete: handleCountdownComplete,
  });

  const {
    isRoomFull,
    isSoloRunning,
    isSoloDisabled,
    isDuoDisabled,
    turnMessage,
  } = useGameMode({
    customName,
    playerCount,
    otherPlayerActive,
    selectedMode,
    currentTurn,
    hasFinishedTurn,
  });

  const handleModeSelect = async (mode: "solo" | "duo") => {
    if (!customName) {
      setNameError("이름을 입력하면 시작할 수 있어요");
      return;
    }

    if (isRoomFull) {
      setNameError("지금은 플레이 중이라 이용할 수 없습니다");
      return;
    }

    if (mode === "solo" && playerCount > 1) {
      setNameError("다른 플레이어가 있어 혼자하기를 할 수 없습니다");
      return;
    }

    if (mode === "duo" && playerCount !== 2) {
      setNameError("둘이서 모드는 방 인원이 2명일 때만 가능합니다");
      return;
    }

    const hasPermission = await requestMotionPermission();
    if (!hasPermission) {
      return;
    }

    setNameError("");
    setSelectedMode(mode);
    setHasFinishedTurn(false);

    // 모드 선택을 Display에 알림
    emitSelectMode(mode);

    if (mode === "duo" && playerCount !== 2) {
      setIsWaitingForDuo(true);
      setIsInGame(false);
      emitAimUpdate({ x: 0, y: 0 });
      return;
    }

    setIsWaitingForDuo(false);
    setCountdown(5); // 카운트다운 시작
  };

  const handleRequestPermission = useCallback(async () => {
    const ok = await requestMotionPermission();
    if (ok) {
      startSensors();
    }
  }, [requestMotionPermission, startSensors]);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-[#1e3c72] to-[#2a5298] px-5">
      {countdown !== null ? (
        <div className="flex flex-col items-center justify-center gap-5">
          <div className="text-[28px] font-bold text-white text-center">
            곧 시작합니다!
          </div>
          <div className="text-[120px] font-bold text-[#FFD700] [text-shadow:0_0_40px_rgba(255,215,0,0.8)]">
            {countdown}
          </div>
          <div className="text-base text-white opacity-80 text-center">
            {selectedMode === "solo" ? "혼자하기" : "둘이서 하기"} 모드
          </div>
        </div>
      ) : isInGame ? (
        <GameScreen
          customName={customName}
          selectedMode={selectedMode}
          turnMessage={turnMessage}
          aimPosition={aimPosition}
          throwsLeft={throwsLeft}
          sensorsReady={sensorsReady}
          sensorError={sensorError}
          onRequestPermission={handleRequestPermission}
        />
      ) : selectedMode ? (
        <ModeWaiting
          selectedMode={selectedMode}
          customName={customName}
          playerCount={playerCount}
          isWaitingForDuo={isWaitingForDuo}
        />
      ) : (
        <ModeSelection
          customName={customName}
          setCustomName={setCustomName}
          playerCount={playerCount}
          isSoloRunning={isSoloRunning}
          isRoomFull={isRoomFull}
          nameError={nameError}
          isSoloDisabled={isSoloDisabled}
          isDuoDisabled={isDuoDisabled}
          onModeSelect={handleModeSelect}
        />
      )}
    </div>
  );
}
