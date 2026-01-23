"use client";

import { useEffect, useCallback, useRef } from "react";
import { debugLog } from "../components/DebugOverlay";

const AIM_TIMEOUT_MS = 15000;

interface UseAimTimeoutProps {
  isInGame: boolean;
  hasFinishedTurn: boolean;
  onTimeout: () => void;
}

interface UseAimTimeoutReturn {
  startAimTimeout: () => void;
  clearAimTimeout: () => void;
}

// 15초 무응답 시 자동 퇴장 처리 hook
export function useAimTimeout({
  isInGame,
  hasFinishedTurn,
  onTimeout,
}: UseAimTimeoutProps): UseAimTimeoutReturn {
  const aimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInGameRef = useRef(false);
  const hasFinishedTurnRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    isInGameRef.current = isInGame;
  }, [isInGame]);

  useEffect(() => {
    hasFinishedTurnRef.current = hasFinishedTurn;
  }, [hasFinishedTurn]);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const clearAimTimeout = useCallback(() => {
    if (aimTimeoutRef.current) {
      clearTimeout(aimTimeoutRef.current);
      aimTimeoutRef.current = null;
    }
  }, []);

  const startAimTimeout = useCallback(() => {
    clearAimTimeout();

    aimTimeoutRef.current = setTimeout(() => {
      if (!isInGameRef.current || hasFinishedTurnRef.current) return;
      debugLog("[Queue] no aim-update for 15s, auto leave");
      onTimeoutRef.current();
    }, AIM_TIMEOUT_MS);
  }, [clearAimTimeout]);

  useEffect(() => {
    if (isInGame && !hasFinishedTurn) return;
    clearAimTimeout();
  }, [isInGame, hasFinishedTurn, clearAimTimeout]);

  useEffect(() => {
    return () => clearAimTimeout();
  }, [clearAimTimeout]);

  return {
    startAimTimeout,
    clearAimTimeout,
  };
}
