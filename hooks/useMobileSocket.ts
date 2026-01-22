import { useEffect, useCallback, useRef, useState } from "react";
import { socket } from "@/shared/socket";
import {
  getPlayerRoom,
  getSlotFromUrl,
  assignEmptySlot,
  releaseSlot,
} from "@/lib/room";

interface UseMobileSocketProps {
  room: string;
  name: string;
  enabled: boolean;
  slot?: 1 | 2 | null;
  onPlayerCountChange?: (count: number) => void;
  onSlotAssigned?: (slot: 1 | 2) => void;
  onGameResult?: (data: GameResultPayload) => void;
}

type GameResultPayload = {
  results: {
    [socketId: string]: {
      result: "win" | "lose" | "tie";
      score: number;
      rank: number;
      totalPlayers: number;
      ranking: Array<{
        name: string;
        score: number;
        rank: number;
      }>;
    };
  };
  ranking: Array<{
    socketId: string;
    name: string;
    score: number;
    rank: number;
  }>;
};

export function useMobileSocket({
  room,
  name,
  enabled,
  slot: providedSlot,
  onPlayerCountChange,
  onSlotAssigned,
  onGameResult,
}: UseMobileSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const throwCountRef = useRef(0);
  const hasJoinedRef = useRef(false);
  const currentRoomRef = useRef<string>("");
  const assignedSlotRef = useRef<1 | 2 | null>(null);

  const onPlayerCountChangeRef = useRef(onPlayerCountChange);
  const onSlotAssignedRef = useRef(onSlotAssigned);
  const onGameResultRef = useRef(onGameResult);

  useEffect(() => {
    onPlayerCountChangeRef.current = onPlayerCountChange;
    onSlotAssignedRef.current = onSlotAssigned;
    onGameResultRef.current = onGameResult;
  }, [onPlayerCountChange, onSlotAssigned, onGameResult]);

  useEffect(() => {
    if (!room || !enabled) return;

    let slot = getSlotFromUrl() || providedSlot;

    if (!slot) {
      slot = assignEmptySlot(room);
      if (!slot) {
        console.error("No available slot (room full)");
        return;
      }
      console.log(`Auto-assigned to slot ${slot}`);
      onSlotAssignedRef.current?.(slot);
    }

    assignedSlotRef.current = slot;

    const playerRoom = getPlayerRoom(room, slot);
    const roomChanged = currentRoomRef.current !== playerRoom;

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

    const joinPlayerRoom = () => {
      if (hasJoinedRef.current && currentRoomRef.current === playerRoom) return;
      socket.emit("joinRoom", { room: playerRoom, name });
      hasJoinedRef.current = true;
      currentRoomRef.current = playerRoom;
    };

    const handleConnect = () => {
      setIsConnected(true);
      joinPlayerRoom();
    };

    const handlePlayerCount = (data: { room: string; playerCount: number }) => {
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      onPlayerCountChangeRef.current?.(actualPlayerCount);
    };

    const handleGameResult = (data: GameResultPayload) => {
      onGameResultRef.current?.(data);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      hasJoinedRef.current = false;
      currentRoomRef.current = "";
      throwCountRef.current = 0;

      if (assignedSlotRef.current) {
        releaseSlot(room, assignedSlotRef.current);
        console.log(`Released slot ${assignedSlotRef.current}`);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("joinedRoom", handlePlayerCount);
    socket.on("roomPlayerCount", handlePlayerCount);
    socket.on("game-result", handleGameResult);

    // 리스너 설정 후 이미 연결된 경우 처리
    if (socket.connected && !hasJoinedRef.current) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("joinedRoom", handlePlayerCount);
      socket.off("roomPlayerCount", handlePlayerCount);
      socket.off("game-result", handleGameResult);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, name, enabled]);

  useEffect(() => {
    return () => {
      socket.disconnect();
      hasJoinedRef.current = false;
      currentRoomRef.current = "";

      if (assignedSlotRef.current) {
        releaseSlot(room, assignedSlotRef.current);
        console.log(`Released slot ${assignedSlotRef.current} on unmount`);
      }
    };
  }, [room]);

  const emitAimUpdate = useCallback(
    (aim: { x: number; y: number }, skin?: string) => {
      if (!socket.connected || !assignedSlotRef.current) return;
      const playerRoom = getPlayerRoom(room, assignedSlotRef.current);
      socket.emit("aim-update", {
        room: playerRoom,
        name,
        skin,
        aim,
      });
    },
    [room, name]
  );

  const emitThrowDart = useCallback(
    (payload: { aim: { x: number; y: number }; score: number }) => {
      if (!socket.connected || !assignedSlotRef.current) return;
      const playerRoom = getPlayerRoom(room, assignedSlotRef.current);
      socket.emit("throw-dart", {
        room: playerRoom,
        name,
        aim: payload.aim,
        score: payload.score,
      });

      throwCountRef.current += 1;

      if (throwCountRef.current >= 3) {
        socket.emit("aim-off", { room: playerRoom, name });
        throwCountRef.current = 3;
      }
    },
    [room, name]
  );

  const emitAimOff = useCallback(() => {
    if (!socket.connected || !assignedSlotRef.current) return;
    const playerRoom = getPlayerRoom(room, assignedSlotRef.current);
    socket.emit("aim-off", { room: playerRoom, name });
  }, [room, name]);

  const leaveGame = useCallback(() => {
    if (assignedSlotRef.current) {
      releaseSlot(room, assignedSlotRef.current);
      assignedSlotRef.current = null;
    }
    throwCountRef.current = 0;
    hasJoinedRef.current = false;
    currentRoomRef.current = "";
    if (socket.connected) {
      socket.disconnect();
    }
  }, [room]);

  return {
    emitAimUpdate,
    emitThrowDart,
    emitAimOff,
    leaveGame,
    socketId: socket.id,
    isConnected,
  };
}
