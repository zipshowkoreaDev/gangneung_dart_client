import { useMemo } from "react";

interface UseGameModeProps {
  customName: string;
  playerCount: number;
  otherPlayerActive: boolean;
  selectedMode: "solo" | "duo" | null;
  currentTurn: string | null;
  hasFinishedTurn: boolean;
}

export function useGameMode({
  customName,
  playerCount,
  otherPlayerActive,
  selectedMode,
  currentTurn,
  hasFinishedTurn,
}: UseGameModeProps) {
  const otherPlayersCount = useMemo(
    () => (customName ? Math.max(0, playerCount - 1) : playerCount),
    [customName, playerCount]
  );

  const isDuoReady = useMemo(() => playerCount === 2, [playerCount]);

  const isRoomFull = useMemo(() => playerCount > 2, [playerCount]);

  const isSoloRunning = useMemo(
    () => otherPlayerActive && otherPlayersCount === 1 && !isDuoReady,
    [otherPlayerActive, otherPlayersCount, isDuoReady]
  );

  const isSoloDisabled = useMemo(
    () => !customName || playerCount > 1 || isSoloRunning || isRoomFull,
    [customName, playerCount, isSoloRunning, isRoomFull]
  );

  const isDuoDisabled = useMemo(
    () => !customName || isSoloRunning || !isDuoReady || isRoomFull,
    [customName, isSoloRunning, isDuoReady, isRoomFull]
  );

  const isMyTurn = useMemo(
    () => (currentTurn ? currentTurn === customName : true),
    [currentTurn, customName]
  );

  const turnMessage = useMemo(() => {
    if (isSoloRunning) {
      return "혼자하기가 진행 중입니다.";
    }
    if (selectedMode === "duo") {
      if (hasFinishedTurn) {
        return "결과를 기다려 주세요";
      }
      return isMyTurn ? "내 차례입니다" : "아직 차례가 아닙니다";
    }
    return "";
  }, [isSoloRunning, selectedMode, hasFinishedTurn, isMyTurn]);

  return {
    otherPlayersCount,
    isDuoReady,
    isRoomFull,
    isSoloRunning,
    isSoloDisabled,
    isDuoDisabled,
    isMyTurn,
    turnMessage,
  };
}
