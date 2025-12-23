"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { socket } from "@/shared/socket";
import { createRoom } from "@/shared/room";
import Scene from "@/three/Scene";
import { QRCodeSVG } from "qrcode.react";

export default function DisplayPage() {
  const [room, setRoom] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [aimPositions, setAimPositions] = useState<
    Map<string, { x: number; y: number; skin?: string }>
  >(new Map());

  // 클라이언트에서만 room 생성 (hydration mismatch 방지)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    setRoom(createRoom());
  }, []);

  useEffect(() => {
    if (!room) return;

    socket.connect();
    socket.emit("join-room", { room });

    // 조준점 업데이트 수신
    socket.on("aim-update", (data) => {
      setAimPositions((prev) => {
        const next = new Map(prev);
        next.set(data.playerId || data.name || "player", {
          x: data.aim.x,
          y: data.aim.y,
          skin: data.skin,
        });
        return next;
      });
    });

    // 조준점 숨김 수신
    socket.on("aim-off", (data) => {
      setAimPositions((prev) => {
        const next = new Map(prev);
        next.delete(data.name || data.playerId || "player");
        return next;
      });
    });

    socket.on("throw", (data) => {
      // 여기서 R3F로 터짐 트리거
      window.dispatchEvent(new CustomEvent("DART_THROW", { detail: data }));
    });

    return () => {
      socket.disconnect();
      socket.off("aim-update");
      socket.off("aim-off");
      socket.off("throw");
    };
  }, [room]);

  // 모바일 접속 URL 생성
  const mobileUrl =
    isMounted && room
      ? // ? `${window.location.protocol}//${window.location.host}/mobile?room=${room}`
        `http://192.168.0.157:3000/mobile?room=${room}`
      : "";

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Room 정보 & QR 코드 */}
      <div
        style={{
          position: "fixed",
          bottom: 10,
          right: 10,
          zIndex: 10,
          background: "rgba(0, 0, 0, 0.9)",
          color: "white",
          padding: "20px 30px",
          borderRadius: 8,
          fontSize: 18,
          fontFamily: "monospace",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* QR 코드 */}
        {isMounted && room && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 15,
            }}
          >
            {/* QR 코드 이미지 */}
            <div
              style={{
                background: "white",
                padding: 15,
                borderRadius: 4,
                boxShadow: "0 4px 20px rgba(255,255,255,0.2)",
              }}
            >
              <QRCodeSVG
                value={mobileUrl}
                size={120}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* URL 표시 (작게) */}
            <div
              style={{
                background: "rgba(255,255,255,0.1)",
                padding: "6px 10px",
                borderRadius: 4,
                fontSize: 11,
                opacity: 0.7,
                maxWidth: 140,
                wordBreak: "break-all",
                textAlign: "center",
              }}
            >
              {mobileUrl}
            </div>
          </div>
        )}
      </div>

      {/* 조준점 표시 */}
      {isMounted &&
        Array.from(aimPositions.entries()).map(([playerId, pos]) => {
          // -1..1 범위를 0..1 범위로 변환
          const x = (pos.x + 1) / 2;
          const y = (pos.y + 1) / 2;

          // 스킨 색상
          const color =
            pos.skin === "red"
              ? "#ff4d4d"
              : pos.skin === "blue"
              ? "#4da3ff"
              : pos.skin === "yellow"
              ? "#ffd24d"
              : "#ff4d4d";

          return (
            <div key={playerId}>
              {/* 조준 원 */}
              <div
                style={{
                  position: "absolute",
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
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

              {/* 중앙 점 */}
              <div
                style={{
                  position: "absolute",
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  zIndex: 6,
                  pointerEvents: "none",
                }}
              />

              {/* 플레이어 이름 표시 */}
              <div
                style={{
                  position: "absolute",
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  transform: "translate(-50%, calc(-50% - 35px))",
                  background: "rgba(0, 0, 0, 0.7)",
                  color: "white",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  zIndex: 7,
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {playerId}
              </div>
            </div>
          );
        })}

      <Canvas
        camera={{
          position: [0, 0, 35], // 8x6 그리드(48개) 전체 포커스
          fov: 60, // FOV 조정
          aspect: 9 / 16, // 9:16 세로 비율
        }}
        dpr={[1, 2]} // 4K를 위한 픽셀 비율 (1x ~ 2x)
        gl={{
          antialias: true,
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
