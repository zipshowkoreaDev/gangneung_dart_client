"use client";

import { useState } from "react";
import { useDisplaySocket } from "@/hooks/useDisplaySocket";
import { generateSessionToken } from "@/lib/session";
import Scoreboard, { PlayerScore } from "./components/Scoreboard";
import AimOverlay from "./components/AimOverlay";
import DisplayQRCode from "./components/DisplayQRCode";
import DartCanvas from "./components/DartCanvas";

type AimState = Map<string, { x: number; y: number; skin?: string }>;

const ROOM = "zipshow";

export default function DisplayPage() {
  const [aimPositions, setAimPositions] = useState<AimState>(() => new Map());
  const [players, setPlayers] = useState<Map<string, PlayerScore>>(
    () => new Map()
  );
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);

  const [mobileUrl] = useState(() => {
    if (typeof window === "undefined") return "";

    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const token = generateSessionToken();
    const url = `${baseUrl}/auth/${token}?room=${ROOM}`;
    console.log("Display QR URL:", url);
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
        <DisplayQRCode url={mobileUrl} />
        <AimOverlay
          aimPositions={aimPositions}
          playerOrder={playerOrder}
          players={players}
        />
        <DartCanvas />
      </div>
    </div>
  );
}
