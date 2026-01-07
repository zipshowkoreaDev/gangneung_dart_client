import {
  useEffect,
  useRef,
  Dispatch,
  SetStateAction,
  useCallback,
} from "react";
import { socket } from "@/shared/socket";

type AimState = Map<string, { x: number; y: number; skin?: string }>;

type PlayerScore = {
  name: string;
  score: number;
  isConnected: boolean;
  isReady: boolean;
  totalThrows: number;
  currentThrows: number;
};

interface UseDisplaySocketProps {
  room: string;
  onLog: (msg: string) => void;
  setAimPositions: Dispatch<SetStateAction<AimState>>;
  setPlayers: Dispatch<SetStateAction<Map<string, PlayerScore>>>;
  setCurrentTurn: Dispatch<SetStateAction<string | null>>;
  setPlayerOrder: Dispatch<SetStateAction<string[]>>;
  setIsSoloMode: Dispatch<SetStateAction<boolean>>;
  setCountdown: Dispatch<SetStateAction<number | null>>;
  players: Map<string, PlayerScore>;
  playerOrder: string[];
  currentTurn: string | null;
  isSoloMode: boolean;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const HIT_RADIUS = 0.6;

function getHitScore(aim?: { x: number; y: number }) {
  const x = clamp(aim?.x ?? 0, -1, 1);
  const y = clamp(aim?.y ?? 0, -1, 1);
  return Math.hypot(x, y) <= HIT_RADIUS ? 1 : 0;
}

function resolvePlayerKey(data: {
  playerId?: string;
  name?: string;
  socketId?: string;
}) {
  return data.playerId || data.name || data.socketId || "player";
}

export function useDisplaySocket({
  room,
  onLog,
  setAimPositions,
  setPlayers,
  setCurrentTurn,
  setPlayerOrder,
  setIsSoloMode,
  setCountdown,
  players,
  playerOrder,
  currentTurn,
  isSoloMode,
}: UseDisplaySocketProps) {
  const playersRef = useRef(players);
  const playerOrderRef = useRef(playerOrder);
  const currentTurnRef = useRef<string | null>(currentTurn);
  const isSoloModeRef = useRef(isSoloMode);
  const lastActivityRef = useRef<Map<string, number>>(new Map());
  const soloTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    playerOrderRef.current = playerOrder;
  }, [playerOrder]);

  useEffect(() => {
    currentTurnRef.current = currentTurn;
  }, [currentTurn]);

  useEffect(() => {
    isSoloModeRef.current = isSoloMode;
  }, [isSoloMode]);

  const resetSoloRoom = useCallback(() => {
    setAimPositions(new Map());
    setPlayers(new Map());
    setPlayerOrder([]);
    setCurrentTurn(null);
    setIsSoloMode(false);
    setCountdown(null);
    lastActivityRef.current = new Map();
    window.dispatchEvent(new CustomEvent("RESET_SCENE"));
    onLog("Solo room reset due to inactivity");
  }, [
    onLog,
    setAimPositions,
    setPlayers,
    setPlayerOrder,
    setCurrentTurn,
    setIsSoloMode,
    setCountdown,
  ]);

  const scheduleSoloInactivityCheck = useCallback(() => {
    if (soloTimeoutRef.current) {
      clearTimeout(soloTimeoutRef.current);
    }

    soloTimeoutRef.current = setTimeout(() => {
      if (!isSoloModeRef.current) return;

      const playersSnapshot = playersRef.current;
      if (playersSnapshot.size !== 1) return;

      const [playerName] = Array.from(playersSnapshot.keys());
      const last = lastActivityRef.current.get(playerName);
      if (!last) return;

      if (Date.now() - last >= SOLO_INACTIVITY_MS) {
        resetSoloRoom();
      }
    }, SOLO_INACTIVITY_MS);
  }, [resetSoloRoom]);

  const emitFinishGame = useCallback(
    (nextPlayers: Map<string, PlayerScore>) => {
      const scores = Array.from(nextPlayers.values()).map((player) => ({
        socketId: player.name,
        name: player.name,
        score: player.score,
      }));

      socket.emit("finish-game", {
        room,
        scores,
      });
    },
    [room]
  );

  const findNextReadyPlayer = (
    order: string[],
    current: string | null,
    nextPlayers: Map<string, PlayerScore>
  ) => {
    if (order.length === 0) return null;
    const startIndex = current ? order.indexOf(current) : -1;
    for (let i = 1; i <= order.length; i += 1) {
      const candidate = order[(startIndex + i) % order.length];
      if (nextPlayers.get(candidate)?.isReady) {
        return candidate;
      }
    }
    return null;
  };

  useEffect(() => {
    if (!room) return;

    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => {
      onLog(`Socket connected: ${socket.id}`);
      // Display도 방에 참가
      socket.emit("joinRoom", { room, name: "_display" });
    };

    // 1. clientInfo
    const onClientInfo = (data: {
      socketId: string;
      name: string;
      room: string;
    }) => {
      onLog(`Client info: ${data.socketId}, ${data.name}, ${data.room}`);
    };

    // 2. joinedRoom
    const onJoinedRoom = (data: { room: string; playerCount: number }) => {
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      onLog(`Room joined: ${data.room}, Players: ${actualPlayerCount}`);
    };

    // 3. roomPlayerCount
    const onRoomPlayerCount = (data: { room: string; playerCount: number }) => {
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      onLog(`Player count: ${actualPlayerCount}`);
      if (isSoloModeRef.current && actualPlayerCount === 0) {
        const playersSnapshot = playersRef.current;
        if (playersSnapshot.size === 1) {
          const [playerName] = Array.from(playersSnapshot.keys());
          lastActivityRef.current.set(playerName, Date.now());
          scheduleSoloInactivityCheck();
          return;
        }
        resetSoloRoom();
      }
    };

    // 4. dart-thrown
    const onDartThrown = (data: {
      room: string;
      name: string;
      aim: { x: number; y: number };
      score: number;
    }) => {
      if (data.room && data.room !== room) return;

      if (!playersRef.current.has(data.name)) {
        onLog(`Ignored dart from unknown player ${data.name}`);
        return;
      }

      lastActivityRef.current.set(data.name, Date.now());
      scheduleSoloInactivityCheck();

      const score = getHitScore(data.aim);
      const hitSound = new Audio("/sound/hit.mp3");
      hitSound.play().catch((e) => console.error("Sound play failed:", e));

      setPlayers((prev) => {
        const next = new Map(prev);
        const player = prev.get(data.name);

        if (player) {
          const newCurrentThrows = player.currentThrows + 1;
          const isLastThrow = newCurrentThrows >= 3;

          next.set(data.name, {
            ...player,
            score: player.score + score,
            totalThrows: player.totalThrows + 1,
            currentThrows: isLastThrow ? 0 : newCurrentThrows,
          });
          onLog(
            `Score: ${data.name} ${player.score} -> ${
              player.score + score
            } (Throw ${newCurrentThrows}/3)`
          );
        }

        return next;
      });

      window.dispatchEvent(
        new CustomEvent("DART_THROW", { detail: { ...data, score } })
      );
    };

    // 5. aim-update
    const onAimUpdate = (data: {
      room?: string;
      playerId?: string;
      name?: string;
      socketId?: string;
      skin?: string;
      aim: { x: number; y: number };
    }) => {
      if (data.room && data.room !== room) return;

      const key = resolvePlayerKey(data);
      const isSoloRunning =
        isSoloModeRef.current &&
        Array.from(playersRef.current.values()).some((player) => player.isReady);

      if (isSoloRunning && key && !playersRef.current.has(key)) {
        onLog(`Solo running: ignore new player ${key}`);
        return;
      }
      const x = clamp(data.aim?.x ?? 0, -1, 1);
      const y = clamp(data.aim?.y ?? 0, -1, 1);

      if (key && key !== "_display") {
        lastActivityRef.current.set(key, Date.now());
        scheduleSoloInactivityCheck();

        let shouldUpdateAim = true;

        setPlayers((prev) => {
          if (isSoloModeRef.current && !prev.has(key) && prev.size >= 1) {
            const next = new Map<string, PlayerScore>();
            next.set(key, {
              name: key,
              score: 0,
              isConnected: true,
              isReady: true,
              totalThrows: 0,
              currentThrows: 0,
            });
            setPlayerOrder([key]);
            setCurrentTurn(key);
            setAimPositions(new Map());
            window.dispatchEvent(new CustomEvent("RESET_SCENE"));
            socket.emit("turn-update", { room, currentTurn: key });
            onLog(`Solo replace: ${key}`);
            return next;
          }

          const next = new Map(prev);
          const existing = next.get(key);

          if (existing) {
            if (!existing.isReady && existing.totalThrows >= 3) {
              shouldUpdateAim = false;
              return prev;
            }
            next.set(key, {
              ...existing,
              isConnected: true,
              isReady: true,
            });
            return next;
          }

          next.set(key, {
            name: key,
            score: 0,
            isConnected: true,
            isReady: true,
            totalThrows: 0,
            currentThrows: 0,
          });
          setPlayerOrder((order) =>
            order.includes(key) ? order : [...order, key]
          );
          setIsSoloMode(next.size <= 1);
          if (!currentTurnRef.current) {
            setCurrentTurn(key);
            socket.emit("turn-update", { room, currentTurn: key });
          }
          onLog(`Player auto-joined: ${key}`);
          return next;
        });

        if (shouldUpdateAim) {
          setAimPositions((prev) => {
            const next = new Map(prev);
            next.set(key, { x, y, skin: data.skin });
            return next;
          });
        }
      }
    };

    // 6. aim-off
    const onAimOff = (data: {
      room?: string;
      playerId?: string;
      name?: string;
      socketId?: string;
    }) => {
      if (data.room && data.room !== room) return;

      const key = resolvePlayerKey(data);
      setAimPositions((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      const playerName = data.name || resolvePlayerKey(data);
      if (playerName !== "_display") {
        if (isSoloModeRef.current) {
          lastActivityRef.current.set(playerName, Date.now());
          setPlayers((prev) => {
            const next = new Map(prev);
            const player = prev.get(playerName);
            if (player) {
              next.set(playerName, { ...player, isReady: false });
            }
            return next;
          });
          scheduleSoloInactivityCheck();
          return;
        }

        let nextPlayers: Map<string, PlayerScore> | null = null;

        setPlayers((prev) => {
          const next = new Map(prev);
          const player = prev.get(playerName);

          if (player) {
            next.set(playerName, { ...player, isReady: false });
            onLog(`Aim off: ${playerName}`);
          }

          nextPlayers = next;
          return next;
        });

        const playersSnapshot = nextPlayers || playersRef.current;
        const anyReady = Array.from(playersSnapshot.values()).some(
          (player) => player.isReady
        );

      if (isSoloModeRef.current || !anyReady) {
        emitFinishGame(playersSnapshot);
        setCountdown(null);
        setCurrentTurn(null);
        return;
      }

        const order =
          playerOrderRef.current.length > 0
            ? playerOrderRef.current
            : Array.from(playersSnapshot.keys());
        const nextTurn = findNextReadyPlayer(
          order,
          currentTurnRef.current || playerName,
          playersSnapshot
        );

        if (nextTurn) {
          setCurrentTurn(nextTurn);
          socket.emit("turn-update", { room, currentTurn: nextTurn });
        }
      }
    };

    // 7. game-result
    const onGameResult = (data: {
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
    }) => {
      onLog(`Game result received`);
      onLog(`Total players: ${data.ranking.length}`);

      data.ranking.forEach((player) => {
        onLog(
          `Rank ${player.rank}: ${player.name} - ${player.score}점 (socketId: ${player.socketId})`
        );
      });

      window.dispatchEvent(new CustomEvent("GAME_RESULT", { detail: data }));
    };

    // 8. game-finished
    const onGameFinished = (data: {
      room: string;
      ranking: Array<{
        name: string;
        score: number;
        rank: number;
      }>;
    }) => {
      onLog(`Game finished in room: ${data.room}`);
      onLog(`Final ranking:`);

      data.ranking.forEach((player) => {
        onLog(`  ${player.rank}위: ${player.name} - ${player.score}점`);
      });

      window.dispatchEvent(new CustomEvent("GAME_FINISHED", { detail: data }));
    };

    socket.on("connect", onConnect);
    socket.on("clientInfo", onClientInfo);
    socket.on("joinedRoom", onJoinedRoom);
    socket.on("roomPlayerCount", onRoomPlayerCount);
    socket.on("dart-thrown", onDartThrown);
    socket.on("aim-update", onAimUpdate);
    socket.on("aim-off", onAimOff);
    socket.on("game-result", onGameResult);
    socket.on("game-finished", onGameFinished);

    return () => {
      socket.off("connect", onConnect);
      socket.off("clientInfo", onClientInfo);
      socket.off("joinedRoom", onJoinedRoom);
      socket.off("roomPlayerCount", onRoomPlayerCount);
      socket.off("dart-thrown", onDartThrown);
      socket.off("aim-update", onAimUpdate);
      socket.off("aim-off", onAimOff);
      socket.off("game-result", onGameResult);
      socket.off("game-finished", onGameFinished);

      if (soloTimeoutRef.current) {
        clearTimeout(soloTimeoutRef.current);
        soloTimeoutRef.current = null;
      }
    };
  }, [
    room,
    onLog,
    setAimPositions,
    setPlayers,
    setCurrentTurn,
    setPlayerOrder,
    setIsSoloMode,
    setCountdown,
    emitFinishGame,
    resetSoloRoom,
    scheduleSoloInactivityCheck,
  ]);

  return {};
}
const SOLO_INACTIVITY_MS = 60_000;
