"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { QRCodeSVG } from "qrcode.react";

import Scene from "@/three/Scene";
import { socket } from "@/shared/socket";
import { useDisplaySocket } from "@/hooks/useDisplaySocket";
import Scoreboard, { PlayerScore } from "@/app/display/components/Scoreboard";

type AimState = Map<string, { x: number; y: number; skin?: string }>;

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

  const [players, setPlayers] = useState<Map<string, PlayerScore>>(
    () => new Map()
  );
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [isSoloMode, setIsSoloMode] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const soloPlayerRef = useRef<string | null>(null);

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

  // 소켓 통신 훅 사용
  useDisplaySocket({
    room,
    onLog: addLog,
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
  });

  // 카운트다운 처리
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // 카운트다운 종료, 첫 번째 플레이어 턴 시작
      const firstPlayer = playerOrder[0];
      if (firstPlayer) {
        setCurrentTurn(firstPlayer);
        socket.emit("turn-update", {
          room,
          currentTurn: firstPlayer,
        });
        addLog(`Game started! Turn: ${firstPlayer}`);
      }
      setCountdown(null);
    }
  }, [countdown, playerOrder, room, addLog]);

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

  return (
    <div
      className="w-full h-full"
      style={{
        position: "relative",
        overflow: "hidden",
        backgroundImage: "url(/04_roulette_BG.webp)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* 스코어보드 - 상단 가로 배치 */}
      <Scoreboard
        isMounted={isMounted}
        players={players}
        currentTurn={currentTurn}
        isSoloMode={isSoloMode}
      />

      {/* 카운트다운 */}
      {countdown !== null && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              fontSize: "200px",
              fontWeight: "bold",
              color: "#FFD700",
              textShadow: "0 0 40px rgba(255, 215, 0, 0.8)",
              animation: "pulse 0.5s ease-in-out",
            }}
          >
            {countdown}
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
        Array.from(aimPositions.entries())
          .filter(([playerKey]) => {
            // 혼자하기 모드일 때는 솔로 플레이어의 조준점만 표시
            if (isSoloMode && soloPlayerRef.current) {
              return playerKey === soloPlayerRef.current;
            }
            // 2인 모드일 때는 준비 완료된 플레이어만 조준점 표시
            const player = players.get(playerKey);
            if (!isSoloMode && player && !player.isReady) {
              return false;
            }
            return true;
          })
          .map(([playerKey, pos]) => {
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
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: "translateY(-12.5%)",
          pointerEvents: "none",
        }}
      >
        <Canvas
          camera={{
            position: [0, 0, 50],
            fov: 50,
          }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
        >
          <Scene />
        </Canvas>
      </div>
    </div>
  );
}
