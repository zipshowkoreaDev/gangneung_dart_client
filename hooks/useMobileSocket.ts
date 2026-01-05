import { useEffect, useCallback } from "react";
import { socket } from "@/shared/socket";

interface UseMobileSocketProps {
  room: string;
  customName: string;
  onLog: (msg: string) => void;
  onSetPlayerCount: (count: number) => void;
  onSetIsRoomFull: (isFull: boolean) => void;
  onSetIsRejected: (isRejected: boolean) => void;
  onConnected?: () => void;
  onJoined?: (data: { room: string; playerCount: number }) => void;
  onTurnUpdate?: (currentTurn: string | null) => void;
}

export function useMobileSocket({
  room,
  customName,
  onLog,
  onSetPlayerCount,
  onSetIsRoomFull,
  onSetIsRejected,
  onConnected,
  onJoined,
  onTurnUpdate,
}: UseMobileSocketProps) {
  useEffect(() => {
    if (!room) return;

    socket.connect();

    const handleConnect = () => {
      onLog(`Socket connected: ${socket.id}`);
      onConnected?.();
      socket.emit("joinRoom", {
        room,
        name: customName,
      });
    };

    const handleConnectError = (err: Error) => {
      onLog(`Connection error: ${err.message}`);
      console.error("Socket error:", err);
    };

    const handleDisconnect = (reason: string) => {
      onLog(`Disconnected: ${reason}`);
    };

    const handleClientInfo = (data: {
      socketId: string;
      name: string;
      room: string;
    }) => {
      onLog(`Client info received: ${data.socketId}`);
    };

    const handleJoinedRoom = (data: { room: string; playerCount: number }) => {
      onLog(`Room joined: ${data.room}, Players: ${data.playerCount}`);
      onSetPlayerCount(data.playerCount);

      if (data.playerCount > 3) {
        onSetIsRoomFull(true);
        onLog(`Room full: ${data.playerCount} players (max 3)`);
        socket.disconnect();
      }

      onJoined?.(data);
    };

    const handleRoomPlayerCount = (data: {
      room: string;
      playerCount: number;
    }) => {
      onLog(`Player count: ${data.playerCount}`);
      onSetPlayerCount(data.playerCount);

      if (data.playerCount > 3) {
        onSetIsRoomFull(true);
        onLog(`Room full: ${data.playerCount} players (max 3)`);
        socket.disconnect();
      }
    };

    const handlePlayerRejected = (data: {
      room: string;
      name: string;
      reason: string;
    }) => {
      if (data.room !== room || data.name !== customName) return;

      onLog(`Player rejected: ${data.reason}`);
      if (data.reason === "solo-mode") {
        onSetIsRejected(true);
        onSetIsRoomFull(true);
        socket.disconnect();
      }
    };

    const handleTurnUpdate = (data: {
      room: string;
      currentTurn: string | null;
    }) => {
      if (data.room && data.room !== room) return;
      onTurnUpdate?.(data.currentTurn);
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.on("clientInfo", handleClientInfo);
    socket.on("joinedRoom", handleJoinedRoom);
    socket.on("roomPlayerCount", handleRoomPlayerCount);
    socket.on("player-rejected", handlePlayerRejected);
    socket.on("turn-update", handleTurnUpdate);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.off("clientInfo", handleClientInfo);
      socket.off("joinedRoom", handleJoinedRoom);
      socket.off("roomPlayerCount", handleRoomPlayerCount);
      socket.off("player-rejected", handlePlayerRejected);
      socket.off("turn-update", handleTurnUpdate);

      if (process.env.NODE_ENV === "production") {
        socket.disconnect();
      }
    };
  }, [
    room,
    customName,
    onLog,
    onSetPlayerCount,
    onSetIsRoomFull,
    onSetIsRejected,
    onConnected,
    onJoined,
    onTurnUpdate,
  ]);

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

  return {
    emitAimUpdate,
    isConnected: socket.connected,
  };
}
