"use client";

import { useState } from "react";
import { useDisplaySocket } from "@/hooks/useDisplaySocket";
import { generateAuthUrl } from "@/lib/url";
import Scoreboard, { PlayerScore } from "./components/Scoreboard";
import AimOverlay from "./components/AimOverlay";
import DisplayQRCode from "./components/DisplayQRCode";
import DartCanvas from "./components/DartCanvas";

type AimState = Map<string, { x: number; y: number; skin?: string }>;

const ROOM = "zipshow";

export default function DisplayPage() {
  const [aimPositions, setAimPositions] = useState<AimState>(() => new Map());
  const [players, setPlayers] = useState<Map<string, PlayerScore>>(() => new Map());
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);

  // lazy initialization으로 클라이언트에서만 QR URL 생성
  const [authUrl] = useState(() => {
    if (typeof window === "undefined") return "";

    const url = generateAuthUrl(ROOM);
    console.log("Display QR URL:", url); // 디버깅
    return url;
  });

  useDisplaySocket({
    room: ROOM,
    setAimPositions,
    setPlayers,
    setCurrentTurn,
    setPlayerOrder,
    players,
    playerOrder,
    currentTurn,
  });

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black overflow-hidden">
      <div className="relative w-full h-full aspect-9/16 max-w-[56.25vh] overflow-hidden bg-[url(/04_roulette_BG.webp)] bg-cover bg-center bg-no-repeat">
        <Scoreboard players={players} currentTurn={currentTurn} />
        <DisplayQRCode url={authUrl} />
        <AimOverlay aimPositions={aimPositions} playerOrder={playerOrder} players={players} />
        <DartCanvas />
      </div>
    </div>
  );
}
