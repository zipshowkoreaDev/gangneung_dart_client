import { useEffect, useCallback, useRef } from "react";
import { socket } from "@/shared/socket";

interface UseMobileSocketProps {
  room: string;
  customName: string;
  onPlayerCountChange?: (count: number) => void;
}

export function useMobileSocket({
  room,
  customName,
  onPlayerCountChange,
}: UseMobileSocketProps) {
  const throwCountRef = useRef(0);

  useEffect(() => {
    if (!room || !customName) return;

    socket.connect();

    const handleConnect = () => {
      // 연결되면 바로 방에 참가
      socket.emit("joinRoom", {
        room,
        name: customName,
      });
    };

    const handleJoinedRoom = (data: { room: string; playerCount: number }) => {
      // joinedRoom에서도 플레이어 수 업데이트 (display 제외)
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      onPlayerCountChange?.(actualPlayerCount);
    };

    const handleRoomPlayerCount = (data: {
      room: string;
      playerCount: number;
    }) => {
      // display 제외한 실제 플레이어 수 전달
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      onPlayerCountChange?.(actualPlayerCount);
    };

    socket.on("connect", handleConnect);
    socket.on("joinedRoom", handleJoinedRoom);
    socket.on("roomPlayerCount", handleRoomPlayerCount);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("joinedRoom", handleJoinedRoom);
      socket.off("roomPlayerCount", handleRoomPlayerCount);

      if (process.env.NODE_ENV === "production") {
        socket.disconnect();
      }
    };
  }, [room, customName, onPlayerCountChange]);

  const emitAimUpdate = useCallback(
    (aim: { x: number; y: number }, skin?: string) => {
      if (!socket.connected || !customName) return;
      socket.emit("aim-update", {
        room,
        name: customName,
        skin,
        aim,
      });
    },
    [room, customName]
  );

  const emitThrowDart = useCallback(
    (payload: { aim: { x: number; y: number }; score: number }) => {
      if (!socket.connected || !customName) return;
      socket.emit("throw-dart", {
        room,
        name: customName,
        aim: payload.aim,
        score: payload.score,
      });

      throwCountRef.current += 1;

      if (throwCountRef.current >= 3) {
        socket.emit("aim-off", {
          room,
          name: customName,
        });
        throwCountRef.current = 3;
      }
    },
    [room, customName]
  );

  const emitFinishGame = useCallback(
    (scores: Array<{ socketId: string; name: string; score: number }>) => {
      if (!room) return;
      socket.emit("finish-game", {
        room,
        scores,
      });
      socket.disconnect();
    },
    [room]
  );

  const emitAimOff = useCallback(() => {
    if (!socket.connected || !customName) return;
    socket.emit("aim-off", {
      room,
      name: customName,
    });
  }, [room, customName]);

  return {
    emitAimUpdate,
    emitThrowDart,
    emitFinishGame,
    emitAimOff,
    socketId: socket.id,
    isConnected: socket.connected,
  };
}
