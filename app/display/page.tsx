"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { QRCodeSVG } from "qrcode.react";

import Scene from "@/three/Scene";
import { socket } from "@/shared/socket";
import { createRoom } from "@/shared/room";

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

type ThrowPayload = {
  room?: string;
  playerId?: string;
  name?: string;
  socketId?: string;
  skin?: string;
  power?: number; // 0..1
  aim?: { x: number; y: number }; // -1..1
};

type AimState = Map<string, { x: number; y: number; skin?: string }>;

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

  // 1) hydration mismatch 방지: client mount 후 room 생성
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    setRoom(createRoom());
  }, []);

  // 2) QR 링크 생성: 도메인/세팅 없으니 아래 우선순위로 결정
  //    - NEXT_PUBLIC_BASE_URL 있으면 그걸 사용 (예: http://192.168.0.157:3000)
  //    - 없으면 window.location.origin 사용
  //    - (정말 필요하면) 마지막에 하드코딩 LAN IP로 교체 가능
  const mobileUrl = useMemo(() => {
    if (!isMounted || !room) return "";

    const base =
      process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
      (typeof window !== "undefined" ? window.location.origin : "");

    // 필요 시 하드코딩:
    // const base = "http://192.168.0.157:3000";

    return `${base}/mobile?room=${encodeURIComponent(room)}`;
  }, [isMounted, room]);

  // 3) socket 연결 & 이벤트 수신
  useEffect(() => {
    if (!room) return;

    // 연결은 display가 주도
    socket.connect();
    socket.emit("join-room", { room, role: "display" });

    const onAimUpdate = (data: AimPayload) => {
      // room 체크(안 넣어도 되지만 안전하게)
      if (data.room && data.room !== room) return;

      const key = resolvePlayerKey(data);
      const x = clamp(data.aim?.x ?? 0, -1, 1);
      const y = clamp(data.aim?.y ?? 0, -1, 1);

      setAimPositions((prev) => {
        const next = new Map(prev);
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
    };

    const onThrow = (data: ThrowPayload) => {
      if (data.room && data.room !== room) return;

      // R3F로 throw 이벤트 전달 (Explosion 트리거 등)
      window.dispatchEvent(new CustomEvent("DART_THROW", { detail: data }));
    };

    socket.on("aim-update", onAimUpdate);
    socket.on("aim-off", onAimOff);
    socket.on("throw", onThrow);

    return () => {
      socket.off("aim-update", onAimUpdate);
      socket.off("aim-off", onAimOff);
      socket.off("throw", onThrow);

      // display는 연결 끊어도 되지만, 개발 중 HMR에서는 끊었다/연결했다 반복이 많아서
      // 깔끔하게 disconnect 하는 편이 안전
      socket.disconnect();
    };
  }, [room]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* QR 카드 */}
      <div
        style={{
          position: "fixed",
          bottom: 10,
          right: 10,
          zIndex: 10,
          background: "rgba(0, 0, 0, 0.9)",
          color: "white",
          padding: "10px 20px",
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
              gap: 6,
            }}
          >
            <div
              style={{
                background: "white",
                padding: 7.5,
                borderRadius: 4,
                boxShadow: "0 4px 20px rgba(255,255,255,0.2)",
              }}
            >
              <QRCodeSVG
                value={mobileUrl}
                size={80}
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

            {/* 개발용 표시 (원하면 지워) */}
            <div style={{ fontSize: 12, opacity: 0.8 }}>ROOM: {room}</div>
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
          aspect: 9 / 16,
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
