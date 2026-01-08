"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { QRCodeSVG } from "qrcode.react";

import Scene from "@/three/Scene";
import { socket } from "@/shared/socket";
import { useDisplaySocket } from "@/hooks/useDisplaySocket";
import { useCountdown } from "@/hooks/useCountdown";
import Scoreboard, { PlayerScore } from "@/app/display/components/Scoreboard";
import AimOverlay from "@/app/display/components/AimOverlay";

type AimState = Map<string, { x: number; y: number; skin?: string }>;

export default function DisplayPage() {
  const room = "zipshow";
  const [aimPositions, setAimPositions] = useState<AimState>(() => new Map());

  const [players, setPlayers] = useState<Map<string, PlayerScore>>(
    () => new Map()
  );
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [isSoloMode, setIsSoloMode] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useDisplaySocket({
    room,
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
    countdown,
  });

  useCountdown({
    countdown,
    setCountdown,
    playerOrder,
    room,
    setCurrentTurn,
    socket,
  });

  const mobileUrl = useMemo(() => {
    if (typeof window === "undefined") return "";

    const isProductionDomain =
      process.env.NEXT_PUBLIC_BASE_URL &&
      window.location.host === new URL(process.env.NEXT_PUBLIC_BASE_URL).host;

    const base = isProductionDomain
      ? process.env.NEXT_PUBLIC_BASE_URL
      : `${window.location.protocol}//${window.location.host}`;

    return `${base}/mobile?room=${encodeURIComponent(room)}`;
  }, []);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black overflow-hidden">
      <div className="relative w-full h-full aspect-9/16 max-w-[56.25vh] overflow-hidden bg-[url(/04_roulette_BG.webp)] bg-cover bg-center bg-no-repeat">
        {/* Scoreboard */}
        <Scoreboard
          players={players}
          currentTurn={currentTurn}
          isSoloMode={isSoloMode}
        />

        {/* Countdown */}
        {countdown !== null && (
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm">
            <div className="text-[12rem] font-bold text-[#FFD700] text-shadow-[0_0_40px_rgba(255_215_0_0.8)] animate-pulse">
              {countdown}
            </div>
          </div>
        )}

        {/* QR */}
        {mobileUrl && (
          <div className="absolute bottom-10 right-10 z-10 bg-white p-3 rounded-sm">
            <QRCodeSVG value={mobileUrl} size={100} level="H" />
          </div>
        )}

        {/* Aim Overlay */}
        <AimOverlay
          aimPositions={aimPositions}
          playerOrder={playerOrder}
          players={players}
          isSoloMode={isSoloMode}
        />

        {/* R3F */}
        <div className="absolute top-0 left-0 w-full h-full translate-y-[-12.5%] pointer-events-none">
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
    </div>
  );
}
