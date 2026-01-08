import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";

interface UseCountdownProps {
  countdown: number | null;
  setCountdown: (value: number | null) => void;
  playerOrder: string[];
  room: string;
  setCurrentTurn: (turn: string | null) => void;
  onLog?: (msg: string) => void;
  socket: Socket;
}

export function useCountdown({
  countdown,
  setCountdown,
  playerOrder,
  room,
  setCurrentTurn,
  onLog,
  socket,
}: UseCountdownProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 카운트다운이 null이면 타이머 정리하고 종료
    if (countdown === null) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // 카운트다운이 0보다 크면 1초 후 감소
    if (countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
        onLog?.(`Countdown: ${countdown - 1}`);
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }

    // 카운트다운이 0이 되면 게임 시작
    if (countdown === 0) {
      const firstPlayer = playerOrder[0];
      if (firstPlayer) {
        setCurrentTurn(firstPlayer);
        socket.emit("turn-update", {
          room,
          currentTurn: firstPlayer,
        });
        onLog?.(`Game started! Turn: ${firstPlayer}`);
      }
      setCountdown(null);
    }
  }, [
    countdown,
    playerOrder,
    room,
    setCountdown,
    setCurrentTurn,
    onLog,
    socket,
  ]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);
}
