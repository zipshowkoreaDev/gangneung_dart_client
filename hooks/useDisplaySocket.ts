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
  onLog?: (msg: string) => void;
  setAimPositions: Dispatch<SetStateAction<AimState>>;
  setPlayers: Dispatch<SetStateAction<Map<string, PlayerScore>>>;
  setCurrentTurn: Dispatch<SetStateAction<string | null>>;
  setPlayerOrder: Dispatch<SetStateAction<string[]>>;
  players: Map<string, PlayerScore>;
  playerOrder: string[];
  currentTurn: string | null;
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
  players,
  playerOrder,
  currentTurn,
}: UseDisplaySocketProps) {
  const playersRef = useRef(players);
  const playerOrderRef = useRef(playerOrder);
  const currentTurnRef = useRef<string | null>(currentTurn);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    playerOrderRef.current = playerOrder;
  }, [playerOrder]);

  useEffect(() => {
    currentTurnRef.current = currentTurn;
  }, [currentTurn]);

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
      onLog?.(`Socket connected: ${socket.id}`);
      socket.emit("joinRoom", { room, name: "_display" });
    };

    const onClientInfo = (data: {
      socketId: string;
      name: string;
      room: string;
    }) => {
      onLog?.(`Client info: ${data.socketId}, ${data.name}, ${data.room}`);
    };

    const onJoinedRoom = (data: { room: string; playerCount: number }) => {
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      onLog?.(`Room joined: ${data.room}, Players: ${actualPlayerCount}`);
    };

    const onRoomPlayerCount = (data: { room: string; playerCount: number }) => {
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      onLog?.(`Player count: ${actualPlayerCount}`);
    };

    const onDartThrown = (data: {
      room: string;
      name: string;
      aim: { x: number; y: number };
      score: number;
    }) => {
      if (data.room && data.room !== room) return;

      if (!playersRef.current.has(data.name)) {
        onLog?.(`Ignored dart from unknown player ${data.name}`);
        return;
      }

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
          onLog?.(
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
      const x = clamp(data.aim?.x ?? 0, -1, 1);
      const y = clamp(data.aim?.y ?? 0, -1, 1);

      if (key && key !== "_display") {
        let shouldUpdateAim = true;
        let addedPlayer = false;

        setPlayers((prev) => {
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

          if (!prev.has(key)) {
            next.set(key, {
              name: key,
              score: 0,
              isConnected: true,
              isReady: true,
              totalThrows: 0,
              currentThrows: 0,
            });
            addedPlayer = true;
            return next;
          }

          return next;
        });

        if (addedPlayer) {
          setPlayerOrder((prev) => {
            if (prev.includes(key)) return prev;
            return [...prev, key];
          });
        }

        if (shouldUpdateAim) {
          setAimPositions((prev) => {
            const next = new Map(prev);
            next.set(key, { x, y, skin: data.skin });
            return next;
          });
        }
      }
    };

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
        let nextPlayers: Map<string, PlayerScore> | null = null;

        setPlayers((prev) => {
          const next = new Map(prev);
          const player = prev.get(playerName);

          if (player) {
            next.set(playerName, { ...player, isReady: false });
            onLog?.(`Aim off: ${playerName}`);
          }

          nextPlayers = next;
          return next;
        });

        const playersSnapshot = nextPlayers || playersRef.current;
        const anyReady = Array.from(playersSnapshot.values()).some(
          (player) => player.isReady
        );

        if (!anyReady) {
          emitFinishGame(playersSnapshot);
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
      onLog?.(`Game result received`);
      onLog?.(`Total players: ${data.ranking.length}`);

      data.ranking.forEach((player) => {
        onLog?.(
          `Rank ${player.rank}: ${player.name} - ${player.score}점 (socketId: ${player.socketId})`
        );
      });

      window.dispatchEvent(new CustomEvent("GAME_RESULT", { detail: data }));
    };

    const onGameFinished = (data: {
      room: string;
      ranking: Array<{
        name: string;
        score: number;
        rank: number;
      }>;
    }) => {
      onLog?.(`Game finished in room: ${data.room}`);
      onLog?.(`Final ranking:`);

      data.ranking.forEach((player) => {
        onLog?.(`  ${player.rank}위: ${player.name} - ${player.score}점`);
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
    };
  }, [
    room,
    onLog,
    setAimPositions,
    setPlayers,
    setCurrentTurn,
    setPlayerOrder,
    emitFinishGame,
  ]);

  return {};
}
