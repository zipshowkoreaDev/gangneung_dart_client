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
  const [aimPosition, setAimPosition] = useState({ x: 0.5, y: 0.5 });

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
      setAimPosition(data.aim);
    });

    socket.on("throw", (data) => {
      // 여기서 R3F로 터짐 트리거
      window.dispatchEvent(new CustomEvent("DART_THROW", { detail: data }));
    });

    return () => {
      socket.disconnect();
      socket.off("aim-update");
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
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Room 정보 & QR 코드 */}
      <div
        style={{
          position: "fixed",
          top: 10,
          left: 10,
          zIndex: 10,
          background: "rgba(0, 0, 0, 0.9)",
          color: "white",
          padding: "20px 30px",
          borderRadius: 16,
          fontSize: 18,
          fontFamily: "monospace",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Room 코드 */}
        {/* <div
          style={{
            fontSize: 32,
            fontWeight: "bold",
            marginBottom: 15,
            textAlign: "center",
          }}
        >
          {isMounted ? `ROOM: ${room}` : "Loading..."}
        </div> */}

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
                borderRadius: 12,
                boxShadow: "0 4px 20px rgba(255,255,255,0.2)",
              }}
            >
              <QRCodeSVG
                value={mobileUrl}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* 안내 텍스트 */}
            <div style={{ fontSize: 14, opacity: 0.9, textAlign: "center" }}>
              📱 모바일로 QR 코드 스캔
            </div>

            {/* URL 표시 (작게) */}
            <div
              style={{
                background: "rgba(255,255,255,0.1)",
                padding: "6px 10px",
                borderRadius: 6,
                fontSize: 11,
                opacity: 0.7,
                maxWidth: 220,
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
      {isMounted && (
        <>
          {/* 조준 원 */}
          <div
            style={{
              position: "absolute",
              left: `${aimPosition.x * 100}%`,
              top: `${aimPosition.y * 100}%`,
              transform: "translate(-50%, -50%)",
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "4px solid rgba(255, 68, 68, 0.9)",
              background: "rgba(255, 68, 68, 0.2)",
              zIndex: 5,
              pointerEvents: "none",
              transition: "all 0.05s ease-out",
            }}
          />

          {/* 중앙 점 */}
          <div
            style={{
              position: "absolute",
              left: `${aimPosition.x * 100}%`,
              top: `${aimPosition.y * 100}%`,
              transform: "translate(-50%, -50%)",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#ff4444",
              zIndex: 6,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      <Canvas camera={{ position: [0, 0, 5] }}>
        <Scene />
      </Canvas>
    </div>
  );
}
