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
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socketUrl, setSocketUrl] = useState("");

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev.slice(-15), `[${timestamp}] ${msg}`]);
  };

  // 1) hydration mismatch 방지: client mount 후 room 생성
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    setRoom(createRoom());
  }, []);

  // 2) QR 링크 생성: 모바일 접속용 IP 사용
  const mobileUrl = useMemo(() => {
    if (!isMounted || !room) return "";

    // 환경변수에 설정된 IP 사용 (모바일에서 접속 가능한 주소)
    // .env.local에서 NEXT_PUBLIC_BASE_URL 설정 필요
    const base = process.env.NEXT_PUBLIC_BASE_URL || "";

    return `${base}/mobile?room=${encodeURIComponent(room)}`;
  }, [isMounted, room]);

  // 3) socket 연결 & 이벤트 수신
  useEffect(() => {
    if (!room) return;

    // Socket URL 저장
    const url = `${window.location.protocol}//${window.location.host}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocketUrl(url);

    // 연결은 display가 주도
    addLog(`소켓 연결 시도 중... (${url})`);
    socket.connect();

    socket.on("connect", () => {
      setIsConnected(true);
      addLog(`✅ 소켓 연결 성공: ${socket.id}`);
      socket.emit("join-room", { room, role: "display" });
      addLog(`🚪 Room 참가: ${room}`);
    });

    socket.on("connect_error", (err) => {
      setIsConnected(false);
      addLog(`❌ 연결 에러: ${err.message}`);
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      addLog(`⚠️ 연결 끊김: ${reason}`);
    });

    const onAimUpdate = (data: AimPayload) => {
      addLog(`🎯 aim-update 수신: ${resolvePlayerKey(data)}`);
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
      addLog(`❌ aim-off 수신: ${resolvePlayerKey(data)}`);
      if (data.room && data.room !== room) return;

      const key = resolvePlayerKey(data);
      setAimPositions((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    };

    const onThrow = (data: ThrowPayload) => {
      addLog(`🎲 throw 수신: ${resolvePlayerKey(data)}`);
      if (data.room && data.room !== room) return;

      // R3F로 throw 이벤트 전달 (Explosion 트리거 등)
      window.dispatchEvent(new CustomEvent("DART_THROW", { detail: data }));
    };

    socket.on("aim-update", onAimUpdate);
    socket.on("aim-off", onAimOff);
    socket.on("throw", onThrow);

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
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
      {/* 디버그 패널 */}
      {isMounted && (
        <div
          style={{
            position: "fixed",
            top: 10,
            left: 10,
            zIndex: 10,
            background: "rgba(0, 0, 0, 0.9)",
            color: "white",
            padding: "10px 15px",
            borderRadius: 8,
            fontFamily: "monospace",
            fontSize: "12px",
            maxWidth: "400px",
            maxHeight: "50vh",
            overflowY: "auto",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
            🔧 Display 디버그
          </div>
          <div style={{ marginBottom: "4px" }}>
            연결: {isConnected ? "🟢" : "🔴"} | Room: {room || "없음"}
          </div>
          <div style={{ marginBottom: "4px", fontSize: "10px", opacity: 0.8 }}>
            Socket: {socketUrl}
          </div>
          <div style={{ marginBottom: "4px" }}>
            조준점: {aimPositions.size}개
          </div>
          <div
            style={{
              marginTop: "8px",
              borderTop: "1px solid #444",
              paddingTop: "4px",
              fontSize: "10px",
            }}
          >
            <strong>로그:</strong>
            {debugLogs.map((log, idx) => (
              <div key={idx} style={{ opacity: 0.9 }}>
                {log}
              </div>
            ))}
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
