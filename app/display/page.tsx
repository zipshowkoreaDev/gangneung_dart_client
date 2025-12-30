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

  // 디버깅: 컴포넌트 마운트/언마운트 추적
  useEffect(() => {
    console.log("✅ DisplayPage 마운트됨", {
      room,
      timestamp: new Date().toLocaleTimeString(),
    });

    return () => {
      console.log("❌ DisplayPage 언마운트됨", {
        room,
        timestamp: new Date().toLocaleTimeString(),
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${msg}`);
  }, []);

  // 1) hydration mismatch 방지: client mount 후 room 생성
  useEffect(() => {
    setTimeout(() => {
      setIsMounted(true);

      // room은 항상 "zipshow"로 고정
      const fixedRoom = "zipshow";
      setRoom(fixedRoom);
      addLog(`🎯 Room 고정: ${fixedRoom}`);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) QR 링크 생성: 하나의 QR 코드만 생성
  const mobileUrl = useMemo(() => {
    if (!isMounted || !room) return "";

    // 프로덕션 도메인으로 접속한 경우
    const isProductionDomain =
      typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_BASE_URL &&
      window.location.host === new URL(process.env.NEXT_PUBLIC_BASE_URL).host;

    // 프로덕션 도메인이면 환경변수 사용, 아니면 현재 접속 중인 호스트 사용
    const base = isProductionDomain
      ? process.env.NEXT_PUBLIC_BASE_URL || ""
      : `${window.location.protocol}//${window.location.host}`;

    return `${base}/mobile`;
  }, [isMounted, room]);

  // 3) socket 연결 & 이벤트 수신
  useEffect(() => {
    if (!room) return;

    console.log("🔌 Socket useEffect 실행", {
      room,
      connected: socket.connected,
      timestamp: new Date().toLocaleTimeString(),
    });

    // 소켓 연결
    if (!socket.connected) {
      addLog(`소켓 연결 시도 중...`);
      socket.connect();
    }

    const onConnect = () => {
      addLog(`✅ 소켓 연결 성공: ${socket.id}`);
      socket.emit("joinRoom", { room, name: "_display" });
      addLog(`🚪 Room 참가 요청: ${room} (Display 모드)`);
    };

    socket.on("connect", onConnect);

    const onConnectError = (err: Error) => {
      addLog(`❌ 연결 에러: ${err.message}`);
    };

    const onDisconnect = (reason: string) => {
      addLog(`⚠️ 연결 끊김: ${reason}`);
    };

    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);

    // 문서 스펙: clientInfo 수신
    const onClientInfo = (data: {
      socketId: string;
      name: string;
      room: string;
    }) => {
      addLog(`📋 클라이언트 정보: ${data.name} (${data.socketId})`);
    };

    // 문서 스펙: joinedRoom 수신
    const onJoinedRoom = (data: { room: string; playerCount: number }) => {
      // Display 자신을 제외한 실제 플레이어 수
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      addLog(
        `✅ 방 참가 완료: ${data.room}, 플레이어 수: ${actualPlayerCount}명`
      );
    };

    // 문서 스펙: roomPlayerCount 수신
    const onRoomPlayerCount = (data: { room: string; playerCount: number }) => {
      // Display 자신을 제외한 실제 플레이어 수 (Display는 플레이어가 아님)
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      addLog(
        `👥 플레이어 수 변경: ${actualPlayerCount}명 (서버: ${data.playerCount}명)`
      );
    };

    socket.on("clientInfo", onClientInfo);
    socket.on("joinedRoom", onJoinedRoom);
    socket.on("roomPlayerCount", onRoomPlayerCount);

    const onAimUpdate = (data: AimPayload) => {
      addLog(`🎯 aim-update 수신: ${resolvePlayerKey(data)}`);
      // room 체크(안 넣어도 되지만 안전하게)
      if (data.room && data.room !== room) return;

      const key = resolvePlayerKey(data);
      const x = clamp(data.aim?.x ?? 0, -1, 1);
      const y = clamp(data.aim?.y ?? 0, -1, 1);

      setAimPositions((prev) => {
        const next = new Map(prev);

        // 최대 2명까지만 허용
        if (!prev.has(key) && prev.size >= 2) {
          addLog(`⚠️ 플레이어 제한: 최대 2명까지만 가능 (${key} 거부됨)`);
          return prev; // 변경하지 않고 이전 상태 유지
        }

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

    // 문서 스펙: dart-thrown 수신
    const onDartThrown = (data: {
      room: string;
      name: string;
      aim: { x: number; y: number };
      score: number;
    }) => {
      addLog(`🎲 dart-thrown 수신: ${data.name}, 점수: ${data.score}`);
      if (data.room && data.room !== room) return;

      // R3F로 throw 이벤트 전달 (Explosion 트리거 등)
      window.dispatchEvent(new CustomEvent("DART_THROW", { detail: data }));
    };

    socket.on("aim-update", onAimUpdate);
    socket.on("aim-off", onAimOff);
    socket.on("dart-thrown", onDartThrown);

    return () => {
      console.log("🧹 Socket useEffect cleanup", {
        room,
        timestamp: new Date().toLocaleTimeString(),
      });

      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
      socket.off("clientInfo", onClientInfo);
      socket.off("joinedRoom", onJoinedRoom);
      socket.off("roomPlayerCount", onRoomPlayerCount);
      socket.off("aim-update", onAimUpdate);
      socket.off("aim-off", onAimOff);
      socket.off("dart-thrown", onDartThrown);

      // 개발 모드에서는 절대 disconnect 하지 않음
      // 프로덕션에서도 페이지를 완전히 떠날 때만 disconnect됨
    };
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
              Room: zipshow
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
