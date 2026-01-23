"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useDisplaySocket } from "@/hooks/useDisplaySocket";
import { generateSessionToken } from "@/lib/session";
import { getRankings, addRanking, RankingEntry } from "@/lib/ranking";
import Scoreboard, { PlayerScore } from "./components/Scoreboard";
import AimOverlay from "./components/AimOverlay";
import RankingBoard from "./components/RankingBoard";
import { getRouletteRadius } from "@/three/Scene";
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
  const [rankings, setRankings] = useState<RankingEntry[]>([]);

  const tokenRef = useRef<string | null>(null);
  const [mobileUrl, setMobileUrl] = useState("");

  // 초기 랭킹 로드
  useEffect(() => {
    setRankings(getRankings());
  }, []);

  const handlePlayerFinish = useCallback((name: string, score: number) => {
    const updated = addRanking(name, score);
    setRankings(updated);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!tokenRef.current) {
      tokenRef.current = generateSessionToken();
    }

    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const buildUrl = (radius?: number) => {
      const params = new URLSearchParams({ room: ROOM });
      if (typeof radius === "number" && radius > 0) {
        params.set("radius", radius.toString());
      }
      setMobileUrl(`${baseUrl}/auth/${tokenRef.current}?${params.toString()}`);
    };

    buildUrl();

    let lastRadius = 0;
    const intervalId = window.setInterval(() => {
      const radius = getRouletteRadius();
      if (!Number.isFinite(radius) || radius <= 0) return;
      const rounded = Math.round(radius * 1_000_000) / 1_000_000;
      if (rounded !== lastRadius) {
        lastRadius = rounded;
        buildUrl(rounded);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useDisplaySocket({
    room: ROOM,
    setAimPositions,
    setPlayers,
    setPlayerOrder,
    setPlayerRoomCounts,
    players,
    playerOrder,
    onPlayerFinish: handlePlayerFinish,
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
        <DartCanvas />
        <RankingBoard rankings={rankings} />
      </div>
    </div>
  );
}
