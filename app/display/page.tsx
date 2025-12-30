"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { QRCodeSVG } from "qrcode.react";

import Scene from "@/three/Scene";
import { socket } from "@/shared/socket";

type AimPayload = {
  room?: string;
  playerId?: string;
  name?: string;
  socketId?: string;
  skin?: string;
  aim: { x: number; y: number }; // -1..1
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
  totalThrows: number;
};

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

function resolveColor(skin?: string) {
  if (skin === "red") return "#ff4d4d";
  if (skin === "blue") return "#4da3ff";
  if (skin === "yellow") return "#ffd24d";
  return "#ff4d4d";
}

export default function DisplayPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [room, setRoom] = useState("");
  const [aimPositions, setAimPositions] = useState<AimState>(() => new Map());

  // 턴제 시스템 state
  const [players, setPlayers] = useState<Map<string, PlayerScore>>(
    () => new Map()
  );
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [isSoloMode, setIsSoloMode] = useState(false); // 혼자하기 모드

  useEffect(() => {
    console.log("DisplayPage mounted", { room });
    return () => {
      console.log("DisplayPage unmounted", { room });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${msg}`);
  }, []);

  const startSoloMode = useCallback(() => {
    if (players.size !== 1) return;

    setIsSoloMode(true);
    const soloPlayer = Array.from(players.keys())[0];
    setCurrentTurn(soloPlayer);
    addLog(`Solo mode started: ${soloPlayer}`);

    socket.emit("solo-mode-started", {
      room,
      player: soloPlayer,
    });
  }, [players, room, addLog]);

  useEffect(() => {
    setTimeout(() => {
      setIsMounted(true);
      const uniqueRoomId = `room-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;
      setRoom(uniqueRoomId);
      addLog(`Room created: ${uniqueRoomId}`);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mobileUrl = useMemo(() => {
    if (!isMounted || !room) return "";

    const isProductionDomain =
      typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_BASE_URL &&
      window.location.host === new URL(process.env.NEXT_PUBLIC_BASE_URL).host;

    const base = isProductionDomain
      ? process.env.NEXT_PUBLIC_BASE_URL || ""
      : `${window.location.protocol}//${window.location.host}`;

    return `${base}/mobile?room=${encodeURIComponent(room)}`;
  }, [isMounted, room]);

  useEffect(() => {
    if (!room) return;

    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => {
      addLog(`Socket connected: ${socket.id}`);
      socket.emit("joinRoom", { room, name: "_display" });
    };

    socket.on("connect", onConnect);

    const onConnectError = (err: Error) => {
      addLog(`Connection error: ${err.message}`);
    };

    const onDisconnect = (reason: string) => {
      addLog(`Disconnected: ${reason}`);
    };

    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);

    const onClientInfo = (data: {
      socketId: string;
      name: string;
      room: string;
    }) => {
      if (data.name === "_display") return;

      if (isSoloMode) {
        addLog(`Solo mode: Player rejected (${data.name})`);
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
          addLog(`Player limit: Max 2 (${data.name} rejected)`);
          return prev;
        }

        if (!prev.has(data.name)) {
          next.set(data.name, {
            name: data.name,
            score: 0,
            isConnected: true,
            totalThrows: 0,
          });
          addLog(`Player joined: ${data.name}`);
        } else {
          const player = prev.get(data.name)!;
          next.set(data.name, { ...player, isConnected: true });
          addLog(`Player reconnected: ${data.name}`);
        }

        return next;
      });

      setPlayerOrder((prev) => {
        if (!prev.includes(data.name)) {
          return [...prev, data.name];
        }
        return prev;
      });

      setCurrentTurn((prevTurn) => {
        if (!prevTurn && data.name !== "_display") {
          addLog(`Turn started: ${data.name}`);
          socket.emit("turn-update", {
            room: data.room,
            currentTurn: data.name,
          });
          return data.name;
        }
        return prevTurn;
      });
    };

    const onJoinedRoom = (data: { room: string; playerCount: number }) => {
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      addLog(`Room joined: ${data.room}, Players: ${actualPlayerCount}`);
    };

    const onRoomPlayerCount = (data: { room: string; playerCount: number }) => {
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      addLog(`Player count: ${actualPlayerCount}`);
    };

    socket.on("clientInfo", onClientInfo);
    socket.on("joinedRoom", onJoinedRoom);
    socket.on("roomPlayerCount", onRoomPlayerCount);

    const onAimUpdate = (data: AimPayload) => {
      if (data.room && data.room !== room) return;

      const key = resolvePlayerKey(data);
      const x = clamp(data.aim?.x ?? 0, -1, 1);
      const y = clamp(data.aim?.y ?? 0, -1, 1);

      setAimPositions((prev) => {
        const next = new Map(prev);
        if (!prev.has(key) && prev.size >= 2) return prev;
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
        setPlayers((prev) => {
          const next = new Map(prev);
          const player = prev.get(playerName);

          if (player) {
            next.set(playerName, { ...player, isConnected: false });
            addLog(`Player left: ${playerName}`);

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
          next.set(data.name, {
            ...player,
            score: player.score + data.score,
            totalThrows: player.totalThrows + 1,
          });
          addLog(
            `Score: ${data.name} ${player.score} -> ${
              player.score + data.score
            }`
          );

          const currentIndex = playerOrder.indexOf(data.name);
          if (currentIndex !== -1 && playerOrder.length > 0) {
            let nextIndex = (currentIndex + 1) % playerOrder.length;
            const startIndex = nextIndex;
            let foundNext = false;

            while (!foundNext) {
              const nextPlayer = playerOrder[nextIndex];
              const nextPlayerData = next.get(nextPlayer);

              if (nextPlayerData?.isConnected) {
                setCurrentTurn(nextPlayer);
                addLog(`Turn: ${data.name} -> ${nextPlayer}`);
                socket.emit("turn-update", {
                  room: data.room,
                  currentTurn: nextPlayer,
                });
                foundNext = true;
                break;
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

        return next;
      });

      window.dispatchEvent(new CustomEvent("DART_THROW", { detail: data }));
    };

    socket.on("aim-update", onAimUpdate);
    socket.on("aim-off", onAimOff);
    socket.on("dart-thrown", onDartThrown);

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, addLog]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 스코어보드 - 상단 가로 배치 */}
      {isMounted && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            zIndex: 10,
            background: "rgba(0, 0, 0, 0.85)",
            color: "white",
            padding: "20px",
            fontFamily: "monospace",
            boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
            backdropFilter: "blur(10px)",
            display: "flex",
            gap: 20,
          }}
        >
          {/* 플레이어 1 */}
          {Array.from(players.values())[0] ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background:
                  currentTurn === Array.from(players.values())[0]?.name
                    ? "rgba(76, 175, 80, 0.3)"
                    : "rgba(255, 255, 255, 0.05)",
                padding: "20px",
                borderRadius: 12,
                border:
                  currentTurn === Array.from(players.values())[0]?.name
                    ? "3px solid #4CAF50"
                    : "3px solid transparent",
                transition: "all 0.3s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 700 }}>
                  {Array.from(players.values())[0]?.name}
                </span>
                {currentTurn === Array.from(players.values())[0]?.name && (
                  <span
                    style={{
                      fontSize: 12,
                      background: "#4CAF50",
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontWeight: 600,
                    }}
                  >
                    턴
                  </span>
                )}
              </div>
              <div style={{ fontSize: 48, fontWeight: 700, color: "#FFD700" }}>
                {Array.from(players.values())[0]?.score}점
              </div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                {Array.from(players.values())[0]?.totalThrows}회 던짐 •{" "}
                {Array.from(players.values())[0]?.isConnected
                  ? "🟢 접속"
                  : "⚫ 나감"}
              </div>
              {/* 혼자하기 버튼 */}
              {players.size === 1 && !isSoloMode && (
                <button
                  onClick={startSoloMode}
                  style={{
                    marginTop: 12,
                    padding: "10px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                    color: "#000",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(255, 215, 0, 0.3)",
                    transition: "transform 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                ></button>
              )}
              {isSoloMode && (
                <div style={{ fontSize: 12, color: "#FFD700", marginTop: 8 }}>
                  혼자하기 모드
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "20px",
                borderRadius: 12,
                fontSize: 16,
                opacity: 0.6,
              }}
            >
              플레이어를 기다리는 중...
            </div>
          )}

          {/* 플레이어 2 */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: Array.from(players.values())[1]
                ? currentTurn === Array.from(players.values())[1]?.name
                  ? "rgba(76, 175, 80, 0.3)"
                  : "rgba(255, 255, 255, 0.05)"
                : "rgba(255, 255, 255, 0.05)",
              padding: "20px",
              borderRadius: 12,
              border: Array.from(players.values())[1]
                ? currentTurn === Array.from(players.values())[1]?.name
                  ? "3px solid #4CAF50"
                  : "3px solid transparent"
                : "3px solid transparent",
              transition: "all 0.3s ease",
            }}
          >
            {Array.from(players.values())[1] ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 700 }}>
                    {Array.from(players.values())[1]?.name}
                  </span>
                  {currentTurn === Array.from(players.values())[1]?.name && (
                    <span
                      style={{
                        fontSize: 12,
                        background: "#4CAF50",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: 6,
                        fontWeight: 600,
                      }}
                    >
                      턴
                    </span>
                  )}
                </div>
                <div
                  style={{ fontSize: 48, fontWeight: 700, color: "#FFD700" }}
                >
                  {Array.from(players.values())[1]?.score}점
                </div>
                <div style={{ fontSize: 14, opacity: 0.7 }}>
                  {Array.from(players.values())[1]?.totalThrows}회 던짐 •{" "}
                  {Array.from(players.values())[1]?.isConnected
                    ? "🟢 접속"
                    : "⚫ 나감"}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* QR 카드 */}
      <div
        style={{
          position: "fixed",
          bottom: 10,
          right: 10,
          zIndex: 10,
          background: "rgba(0, 0, 0, 0.9)",
          color: "white",
          padding: "15px 20px",
          borderRadius: 8,
          fontFamily: "monospace",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          backdropFilter: "blur(10px)",
        }}
      >
        {isMounted && room && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                background: "white",
                padding: 10,
                borderRadius: 4,
                boxShadow: "0 4px 20px rgba(255,255,255,0.2)",
              }}
            >
              <QRCodeSVG
                value={mobileUrl}
                size={100}
                level="H"
                includeMargin={false}
              />
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                opacity: 0.9,
                textAlign: "center",
              }}
            >
              QR 코드 스캔
            </div>
            <div
              style={{
                fontSize: 11,
                opacity: 0.7,
                textAlign: "center",
              }}
            >
              Room: {room.substring(0, 15)}...
            </div>
          </div>
        )}
      </div>

      {/* 조준점 Overlay (DOM) */}
      {isMounted &&
        Array.from(aimPositions.entries()).map(([playerKey, pos]) => {
          // -1..1 → 0..1
          const x01 = (pos.x + 1) / 2;
          const y01 = (pos.y + 1) / 2;

          const color = resolveColor(pos.skin);

          return (
            <div key={playerKey}>
              <div
                style={{
                  position: "absolute",
                  left: `${x01 * 100}%`,
                  top: `${y01 * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: `4px solid ${color}`,
                  background: `${color}33`,
                  zIndex: 5,
                  pointerEvents: "none",
                  transition: "all 0.05s ease-out",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${x01 * 100}%`,
                  top: `${y01 * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  zIndex: 6,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${x01 * 100}%`,
                  top: `${y01 * 100}%`,
                  transform: "translate(-50%, calc(-50% - 35px))",
                  background: "rgba(0, 0, 0, 0.7)",
                  color: "white",
                  padding: "4px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  zIndex: 7,
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {playerKey}
              </div>
            </div>
          );
        })}

      {/* R3F */}
      <Canvas
        camera={{
          position: [0, 0, 50],
          fov: 50,
        }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        {/* <Machine /> */}
        <Scene />
      </Canvas>
    </div>
  );
}
