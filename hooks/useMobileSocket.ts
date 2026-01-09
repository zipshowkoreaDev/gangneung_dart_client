import { useEffect, useCallback, useRef } from "react";
import { socket } from "@/shared/socket";

interface UseMobileSocketProps {
  room: string;
  name: string;
  enabled: boolean;
  onPlayerCountChange?: (count: number) => void;
  onTurnUpdate?: (currentTurn: string | null) => void;
}

export function useMobileSocket({
  room,
  name,
  enabled,
  onPlayerCountChange,
  onTurnUpdate,
}: UseMobileSocketProps) {
  const throwCountRef = useRef(0);
  const hasJoinedRef = useRef(false);
  const currentRoomRef = useRef<string>("");

  // 콜백을 ref에 저장하여 최신 값 유지
  const onPlayerCountChangeRef = useRef(onPlayerCountChange);
  const onTurnUpdateRef = useRef(onTurnUpdate);

  useEffect(() => {
    onPlayerCountChangeRef.current = onPlayerCountChange;
    onTurnUpdateRef.current = onTurnUpdate;
  }, [onPlayerCountChange, onTurnUpdate]);

  useEffect(() => {
    if (!room || !enabled) return;

    const roomChanged = currentRoomRef.current !== room;

    if (hasJoinedRef.current && !roomChanged) {
      return;
    }

    if (roomChanged && socket.connected) {
      socket.disconnect();
      hasJoinedRef.current = false;
    }

    if (!socket.connected) {
      socket.connect();
    }

    const handleConnect = () => {
      if (hasJoinedRef.current && currentRoomRef.current === room) {
        return;
      }

      socket.emit("joinRoom", { room, name });
      hasJoinedRef.current = true;
      currentRoomRef.current = room;
    };

    if (socket.connected && !hasJoinedRef.current) {
      socket.emit("joinRoom", { room, name });
      hasJoinedRef.current = true;
      currentRoomRef.current = room;
    }

    const handleJoinedRoom = (data: { room: string; playerCount: number }) => {
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      onPlayerCountChangeRef.current?.(actualPlayerCount);
    };

    const handleRoomPlayerCount = (data: {
      room: string;
      playerCount: number;
    }) => {
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      onPlayerCountChangeRef.current?.(actualPlayerCount);
    };

    const handleTurnUpdate = (data: {
      room?: string;
      currentTurn?: string | null;
    }) => {
      if (data.room && data.room !== room) return;
      onTurnUpdateRef.current?.(data.currentTurn ?? null);
    };

    const handleDisconnect = () => {
      hasJoinedRef.current = false;
      currentRoomRef.current = "";
      throwCountRef.current = 0;
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("joinedRoom", handleJoinedRoom);
    socket.on("roomPlayerCount", handleRoomPlayerCount);
    socket.on("turn-update", handleTurnUpdate);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("joinedRoom", handleJoinedRoom);
      socket.off("roomPlayerCount", handleRoomPlayerCount);
      socket.off("turn-update", handleTurnUpdate);
    };
  }, [room, name, enabled]);

  // 컴포넌트 언마운트 시 disconnect
  useEffect(() => {
    return () => {
      socket.disconnect();
      hasJoinedRef.current = false;
      currentRoomRef.current = "";
    };
  }, []);

  const emitAimUpdate = useCallback(
    (aim: { x: number; y: number }, skin?: string) => {
      if (!socket.connected) return;
      socket.emit("aim-update", {
        room,
        name,
        skin,
        aim,
      });
    },
    [room, name]
  );

  const emitThrowDart = useCallback(
    (payload: { aim: { x: number; y: number }; score: number }) => {
      if (!socket.connected) return;
      socket.emit("throw-dart", {
        room,
        name,
        aim: payload.aim,
        score: payload.score,
      });

      throwCountRef.current += 1;

      if (throwCountRef.current >= 3) {
        socket.emit("aim-off", { room, name });
        throwCountRef.current = 3;
      }
    },
    [room, name]
  );

  const emitAimOff = useCallback(() => {
    if (!socket.connected) return;
    socket.emit("aim-off", { room, name });
  }, [room, name]);

  return {
    emitAimUpdate,
    emitThrowDart,
    emitAimOff,
    socketId: socket.id,
    isConnected: socket.connected,
  };
}
