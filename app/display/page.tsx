"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useDisplaySocket } from "@/hooks/useDisplaySocket";
import { socket } from "@/shared/socket";
import { generateSessionToken } from "@/lib/session";
import Scoreboard, { PlayerScore } from "./components/Scoreboard";
import AimOverlay from "./components/AimOverlay";
const DisplayQRCode = dynamic(() => import("./components/DisplayQRCode"), {
  ssr: false,
});
import DartCanvas from "./components/DartCanvas";

type AimState = Map<string, { x: number; y: number; skin?: string }>;

const ROOM = "zipshow";

export default function DisplayPage() {
  const [aimPositions, setAimPositions] = useState<AimState>(() => new Map());
  const [players, setPlayers] = useState<Map<string, PlayerScore>>(
    () => new Map()
  );
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [, setPlayerRoomCounts] = useState<Map<string, number>>(
    () => new Map()
  );

  const [mobileUrl] = useState(() => {
    if (typeof window === "undefined") return "";

    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const token = generateSessionToken();
    const url = `${baseUrl}/auth/${token}?room=${ROOM}`;
    return url;
  });

  useDisplaySocket({
    room: ROOM,
    setAimPositions,
    setPlayers,
    setPlayerOrder,
    setPlayerRoomCounts,
    players,
    playerOrder,
  });

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black overflow-hidden">
      <div className="relative w-full h-full aspect-9/16 max-w-[56.25vh] overflow-hidden bg-[url(/04_roulette_BG.webp)] bg-cover bg-center bg-no-repeat">
        <Scoreboard players={players} />
        <DisplayQRCode url={mobileUrl} />
        <AimOverlay
          aimPositions={aimPositions}
          playerOrder={playerOrder}
          players={players}
        />
        <button
          type="button"
          onClick={() => socket.emit("reset-queue", { project: "dart" })}
          className="absolute right-4 top-[210px] px-2.5 py-1 text-[10px] font-semibold rounded bg-white/80 text-black shadow hover:bg-white"
        >
          큐 초기화
        </button>
        <DartCanvas />
      </div>
    </div>
  );
}
