import { useEffect, useRef, Dispatch, SetStateAction } from "react";
import { socket } from "@/shared/socket";

type AimPayload = {
  room?: string;
  playerId?: string;
  name?: string;
  socketId?: string;
  skin?: string;
  aim: { x: number; y: number };
};

type AimOffPayload = {
  room?: string;
  playerId?: string;
  name?: string;
  socketId?: string;
};

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
  countdown: number | null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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
  countdown,
}: UseDisplaySocketProps) {
  const isSoloModeRef = useRef(false);
  const soloPlayerRef = useRef<string | null>(null);
  const playersRef = useRef<Map<string, PlayerScore>>(new Map());

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    if (!room) return;

    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => {
      onLog(`Socket connected: ${socket.id}`);
      socket.emit("joinRoom", { room, name: "_display" });
    };

    const onConnectError = (err: Error) => {
      onLog(`Connection error: ${err.message}`);
    };

    const onDisconnect = (reason: string) => {
      onLog(`Disconnected: ${reason}`);
    };

    const onClientInfo = (data: {
      socketId: string;
      name: string;
      room: string;
    }) => {
      if (data.name === "_display") return;

      if (isSoloModeRef.current) {
        onLog(`Solo mode: Player rejected (${data.name})`);
        socket.emit("player-rejected", {
          room: data.room,
          name: data.name,
          reason: "solo-mode",
        });
        return;
      }

      setPlayers((prev) => {
        const next = new Map(prev);

        if (!prev.has(data.name) && prev.size >= 2) {
          onLog(`Player limit: Max 2 (${data.name} rejected)`);
          return prev;
        }

        if (!prev.has(data.name)) {
          next.set(data.name, {
            name: data.name,
            score: 0,
            isConnected: true,
            isReady: false,
            totalThrows: 0,
            currentThrows: 0,
          });
          onLog(`Player joined: ${data.name}`);
        } else {
          const player = prev.get(data.name)!;
          next.set(data.name, { ...player, isConnected: true });
          onLog(`Player reconnected: ${data.name}`);
        }

        return next;
      });

      setPlayerOrder((prev) => {
        if (!prev.includes(data.name)) {
          return [...prev, data.name];
        }
        return prev;
      });
    };

    const onJoinedRoom = (data: { room: string; playerCount: number }) => {
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      onLog(`Room joined: ${data.room}, Players: ${actualPlayerCount}`);
    };

    const onRoomPlayerCount = (data: {
      room: string;
      playerCount: number;
    }) => {
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      onLog(`Player count: ${actualPlayerCount}`);
    };

    const onAimUpdate = (data: AimPayload) => {
      if (data.room && data.room !== room) return;

      const key = resolvePlayerKey(data);

      // 준비 완료 특수 신호 처리 (999, 999)
      if (
        data.aim.x === 999 &&
        data.aim.y === 999 &&
        key &&
        key !== "_display"
      ) {
        setPlayers((prev) => {
          const next = new Map(prev);
          const player = prev.get(key);

          if (player && !player.isReady) {
            next.set(key, { ...player, isReady: true });
            onLog(`Player ready: ${key}`);

            if (!isSoloModeRef.current && next.size === 2) {
              const allReady = Array.from(next.values()).every(
                (p) => p.isReady
              );
              onLog(
                `Ready check: size=${
                  next.size
                }, allReady=${allReady}, countdown=${countdown}, players=${Array.from(
                  next.entries()
                )
                  .map(([k, v]) => `${k}:${v.isReady}`)
                  .join(", ")}`
              );

              if (allReady && countdown === null) {
                onLog(`Both players ready! Starting countdown...`);
                setCountdown(5);
              }
            }
          }

          return next;
        });
        return;
      }

      const x = clamp(data.aim?.x ?? 0, -1, 1);
      const y = clamp(data.aim?.y ?? 0, -1, 1);

      if (key && key !== "_display") {
        setPlayers((prev) => {
          if (prev.has(key)) return prev;

          if (isSoloModeRef.current) {
            onLog(`Solo mode: Player rejected (${key})`);
            socket.emit("player-rejected", {
              room,
              name: key,
              reason: "solo-mode",
            });
            return prev;
          }

          if (prev.size >= 2) {
            onLog(`Player limit: Max 2 (${key} rejected)`);
            return prev;
          }

          const next = new Map(prev);
          next.set(key, {
            name: key,
            score: 0,
            isConnected: true,
            isReady: false,
            totalThrows: 0,
            currentThrows: 0,
          });
          onLog(
            `Player auto-joined: ${key} from ${data.name || data.socketId}`
          );

          setPlayerOrder((prevOrder) => {
            if (!prevOrder.includes(key)) {
              const newOrder = [...prevOrder, key];
              onLog(`Player order updated: [${newOrder.join(", ")}]`);
              return newOrder;
            }
            return prevOrder;
          });

          return next;
        });
      }

      setAimPositions((prev) => {
        const next = new Map(prev);
        if (!prev.has(key) && prev.size >= 2) return prev;

        if (isSoloModeRef.current && key !== soloPlayerRef.current) {
          onLog(`Solo mode: Aim blocked for ${key}`);
          return prev;
        }

        const player = playersRef.current.get(key);
        if (
          !isSoloModeRef.current &&
          playersRef.current.size >= 2 &&
          player &&
          !player.isReady
        ) {
          onLog(`Aim blocked: ${key} not ready`);
          return prev;
        }

        next.set(key, { x, y, skin: data.skin });
        return next;
      });
    };

    const onAimOff = (data: AimOffPayload) => {
      if (data.room && data.room !== room) return;

      const key = resolvePlayerKey(data);
      setAimPositions((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      const playerName = data.name || resolvePlayerKey(data);
      if (playerName !== "_display") {
        if (isSoloModeRef.current && playerName === soloPlayerRef.current) {
          onLog(`Solo player left: ${playerName} - Resetting room`);

          setIsSoloMode(false);
          isSoloModeRef.current = false;
          soloPlayerRef.current = null;

          setPlayers(new Map());
          setPlayerOrder([]);
          setCurrentTurn(null);
          setAimPositions(new Map());

          socket.emit("turn-update", {
            room: data.room,
            currentTurn: null,
          });

          return;
        }

        setPlayers((prev) => {
          const next = new Map(prev);
          const player = prev.get(playerName);

          if (player) {
            next.set(playerName, { ...player, isConnected: false });
            onLog(`Player disconnected: ${playerName}`);

            setCurrentTurn((currentTurn) => {
              if (currentTurn === playerName) {
                socket.emit("turn-update", {
                  room: data.room,
                  currentTurn: null,
                });
                return null;
              }
              return currentTurn;
            });
          }

          return next;
        });
      }
    };

    const onDartThrown = (data: {
      room: string;
      name: string;
      aim: { x: number; y: number };
      score: number;
    }) => {
      if (data.room && data.room !== room) return;

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
            score: player.score + data.score,
            totalThrows: player.totalThrows + 1,
            currentThrows: isLastThrow ? 0 : newCurrentThrows,
          });
          onLog(
            `Score: ${data.name} ${player.score} -> ${
              player.score + data.score
            } (Throw ${newCurrentThrows}/3)`
          );

          if (isLastThrow) {
            const currentIndex = playerOrder.indexOf(data.name);
            if (currentIndex !== -1 && playerOrder.length > 0) {
              let nextIndex = (currentIndex + 1) % playerOrder.length;
              const startIndex = nextIndex;
              let foundNext = false;

              while (!foundNext) {
                const nextPlayer = playerOrder[nextIndex];
                const nextPlayerData = next.get(nextPlayer);

                if (nextPlayerData?.isConnected) {
                  next.set(nextPlayer, {
                    ...nextPlayerData,
                    currentThrows: 0,
                  });
                  setCurrentTurn(nextPlayer);
                  onLog(
                    `Turn rotation: ${
                      data.name
                    } -> ${nextPlayer} (order: [${playerOrder.join(", ")}])`
                  );
                  socket.emit("turn-update", {
                    room: data.room,
                    currentTurn: nextPlayer,
                  });
                  foundNext = true;
                  break;
                } else {
                  onLog(`Skipping ${nextPlayer} (not connected)`);
                }

                nextIndex = (nextIndex + 1) % playerOrder.length;

                if (nextIndex === startIndex) {
                  setCurrentTurn(null);
                  socket.emit("turn-update", {
                    room: data.room,
                    currentTurn: null,
                  });
                  foundNext = true;
                  break;
                }
              }
            }
          }
        }

        return next;
      });

      window.dispatchEvent(new CustomEvent("DART_THROW", { detail: data }));
    };

    const onSoloModeStarted = (data: { room: string; player: string }) => {
      onLog(
        `solo-mode-started received: room=${data.room}, player=${data.player}, currentRoom=${room}`
      );

      if (data.room && data.room !== room) {
        onLog(`Room mismatch: ${data.room} !== ${room}`);
        return;
      }

      const playerExists = players.has(data.player);
      onLog(
        `Player check: exists=${playerExists}, size=${
          players.size
        }, players=${Array.from(players.keys()).join(", ")}`
      );

      if (!playerExists || players.size !== 1) {
        onLog(
          `Solo mode rejected: invalid player or count (${data.player}, size=${players.size})`
        );
        return;
      }

      setIsSoloMode(true);
      isSoloModeRef.current = true;
      soloPlayerRef.current = data.player;
      setCurrentTurn(data.player);
      onLog(
        `Solo mode started: ${data.player}, isSoloModeRef=${isSoloModeRef.current}`
      );

      setPlayers((prev) => {
        const next = new Map(prev);
        const player = prev.get(data.player);
        if (player) {
          next.set(data.player, { ...player, isReady: true });
          onLog(`Solo player set to ready: ${data.player}`);
        }
        return next;
      });

      setAimPositions((prev) => {
        const next = new Map(prev);
        Array.from(next.keys()).forEach((key) => {
          if (key !== data.player) {
            next.delete(key);
            onLog(`Removed aim for ${key} (solo mode)`);
          }
        });
        return next;
      });

      socket.emit("turn-update", {
        room,
        currentTurn: data.player,
      });
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);
    socket.on("clientInfo", onClientInfo);
    socket.on("joinedRoom", onJoinedRoom);
    socket.on("roomPlayerCount", onRoomPlayerCount);
    socket.on("aim-update", onAimUpdate);
    socket.on("aim-off", onAimOff);
    socket.on("dart-thrown", onDartThrown);
    socket.on("solo-mode-started", onSoloModeStarted);

    return () => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
      socket.off("clientInfo", onClientInfo);
      socket.off("joinedRoom", onJoinedRoom);
      socket.off("roomPlayerCount", onRoomPlayerCount);
      socket.off("aim-update", onAimUpdate);
      socket.off("aim-off", onAimOff);
      socket.off("dart-thrown", onDartThrown);
      socket.off("solo-mode-started", onSoloModeStarted);
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
    players,
    playerOrder,
    countdown,
  ]);

  return {
    isSoloModeRef,
    soloPlayerRef,
  };
}
