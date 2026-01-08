import { useEffect, useCallback, useRef } from "react";
import { socket } from "@/shared/socket";

interface UseMobileSocketProps {
  room: string;
  customName: string;
  selectedMode?: "solo" | "duo" | null;
  onPlayerCountChange?: (count: number) => void;
  onOtherPlayerActive?: (active: boolean) => void;
  onTurnUpdate?: (currentTurn: string | null) => void;
}

export function useMobileSocket({
  room,
  customName,
  selectedMode,
  onPlayerCountChange,
  onOtherPlayerActive,
  onTurnUpdate,
}: UseMobileSocketProps) {
  const throwCountRef = useRef(0);
  const otherPlayerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const hasJoinedRef = useRef(false);
  const currentRoomRef = useRef<string>("");
  const currentNameRef = useRef<string>("");
  const selectedModeRef = useRef<"solo" | "duo" | null>(null);
  const OTHER_PLAYER_IDLE_MS = 60_000;

  useEffect(() => {
    selectedModeRef.current = selectedMode ?? null;
  }, [selectedMode]);

  useEffect(() => {
    if (!selectedMode || !room || !customName) return;
    if (!socket.connected || !hasJoinedRef.current) return;
    socket.emit("select-mode", {
      room,
      name: customName,
      mode: selectedMode,
    });
  }, [selectedMode, room, customName]);

  useEffect(() => {
    if (!room || !customName) return;

    // room이나 customName이 변경되었는지 확인
    const roomChanged = currentRoomRef.current !== room;
    const nameChanged = currentNameRef.current !== customName;

    // 같은 room, name으로 이미 참가했으면 중복 참가 방지
    if (
      hasJoinedRef.current &&
      !roomChanged &&
      !nameChanged
    ) {
      return;
    }

    // room이나 name이 변경되었으면 disconnect 후 재연결
    if ((roomChanged || nameChanged) && socket.connected) {
      socket.disconnect();
      hasJoinedRef.current = false;
    }

    // 이미 연결되어 있지 않으면 연결
    if (!socket.connected) {
      socket.connect();
    }

    const handleConnect = () => {
      // 중복 참가 방지
      if (hasJoinedRef.current && currentRoomRef.current === room && currentNameRef.current === customName) {
        return;
      }

      // 연결되면 바로 방에 참가
      socket.emit("joinRoom", {
        room,
        name: customName,
      });
      hasJoinedRef.current = true;
      currentRoomRef.current = room;
      currentNameRef.current = customName;

      const pendingMode = selectedModeRef.current;
      if (pendingMode) {
        socket.emit("select-mode", {
          room,
          name: customName,
          mode: pendingMode,
        });
      }
    };

    // 이미 연결되어 있으면 바로 joinRoom
    if (socket.connected && !hasJoinedRef.current) {
      socket.emit("joinRoom", {
        room,
        name: customName,
      });
      hasJoinedRef.current = true;
      currentRoomRef.current = room;
      currentNameRef.current = customName;

      const pendingMode = selectedModeRef.current;
      if (pendingMode) {
        socket.emit("select-mode", {
          room,
          name: customName,
          mode: pendingMode,
        });
      }
    }

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
      if (actualPlayerCount === 0) {
        if (otherPlayerTimeoutRef.current) {
          clearTimeout(otherPlayerTimeoutRef.current);
          otherPlayerTimeoutRef.current = null;
        }
        onOtherPlayerActive?.(false);
      }
    };

    const markOtherPlayerActive = () => {
      onOtherPlayerActive?.(true);
      if (otherPlayerTimeoutRef.current) {
        clearTimeout(otherPlayerTimeoutRef.current);
      }
      otherPlayerTimeoutRef.current = setTimeout(() => {
        onOtherPlayerActive?.(false);
      }, OTHER_PLAYER_IDLE_MS);
    };

    const handleAimUpdate = (data: {
      room?: string;
      name?: string;
      aim?: { x: number; y: number };
    }) => {
      if (data.room && data.room !== room) return;
      if (!data.name || data.name === customName || data.name === "_display") {
        return;
      }
      markOtherPlayerActive();
    };

    const handleDartThrown = (data: { room?: string; name?: string }) => {
      if (data.room && data.room !== room) return;
      if (!data.name || data.name === customName || data.name === "_display") {
        return;
      }
      markOtherPlayerActive();
    };

    const handleTurnUpdate = (data: {
      room?: string;
      currentTurn?: string | null;
    }) => {
      if (data.room && data.room !== room) return;
      onTurnUpdate?.(data.currentTurn ?? null);
    };

    const handleSelectMode = (data: {
      room?: string;
      name?: string;
      mode?: "solo" | "duo";
    }) => {
      if (data.room && data.room !== room) return;
      if (!data.name || data.name === customName || data.name === "_display") {
        return;
      }
      // 다른 플레이어가 모드를 선택하면 활성화로 표시
      if (data.mode === "solo") {
        markOtherPlayerActive();
      }
    };

    socket.on("connect", handleConnect);
    socket.on("joinedRoom", handleJoinedRoom);
    socket.on("roomPlayerCount", handleRoomPlayerCount);
    socket.on("aim-update", handleAimUpdate);
    socket.on("dart-thrown", handleDartThrown);
    socket.on("turn-update", handleTurnUpdate);
    socket.on("select-mode", handleSelectMode);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("joinedRoom", handleJoinedRoom);
      socket.off("roomPlayerCount", handleRoomPlayerCount);
      socket.off("aim-update", handleAimUpdate);
      socket.off("dart-thrown", handleDartThrown);
      socket.off("turn-update", handleTurnUpdate);
      socket.off("select-mode", handleSelectMode);

      if (otherPlayerTimeoutRef.current) {
        clearTimeout(otherPlayerTimeoutRef.current);
        otherPlayerTimeoutRef.current = null;
      }
      onOtherPlayerActive?.(false);

      // hasJoinedRef는 유지하여 React Strict Mode에서 중복 참가 방지
      // disconnect는 하지 않음 (컴포넌트 언마운트 시에만 disconnect)
    };
  }, [room, customName, onPlayerCountChange, onOtherPlayerActive, onTurnUpdate]);

  // 컴포넌트 언마운트 시 disconnect
  useEffect(() => {
    return () => {
      socket.disconnect();
      hasJoinedRef.current = false;
      currentRoomRef.current = "";
      currentNameRef.current = "";
    };
  }, []);

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

  const emitSelectMode = useCallback(
    (mode: "solo" | "duo") => {
      if (!socket.connected || !customName) return;
      socket.emit("select-mode", {
        room,
        name: customName,
        mode,
      });
    },
    [room, customName]
  );

  return {
    emitAimUpdate,
    emitThrowDart,
    emitFinishGame,
    emitAimOff,
    emitSelectMode,
    socketId: socket.id,
    isConnected: socket.connected,
  };
}
