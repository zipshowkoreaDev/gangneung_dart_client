"use client";

import { useEffect, useState, useRef } from "react";
import { socket } from "@/shared/socket";

export default function MobilePage() {
  const [room, setRoom] = useState("");
  const [aim, setAim] = useState({ x: 0.5, y: 0.5 }); // 중앙 시작
  const aimAreaRef = useRef<HTMLDivElement>(null);

  // URL 파라미터에서 room 읽기
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoom(roomParam || "DEMO");
  }, []);

  useEffect(() => {
    if (!room) return;

    socket.connect();
    socket.emit("join-room", { room });

    return () => {
      socket.disconnect();
    };
  }, [room]);

  // 조준점 업데이트 및 실시간 전송
  const updateAim = (clientX: number, clientY: number) => {
    if (!aimAreaRef.current) return;

    const rect = aimAreaRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    // 0-1 범위로 제한
    const normalizedX = Math.max(0, Math.min(1, x));
    const normalizedY = Math.max(0, Math.min(1, y));

    setAim({ x: normalizedX, y: normalizedY });

    // 실시간으로 조준점 전송
    socket.emit("aim-update", {
      room,
      playerId: "p1",
      aim: { x: normalizedX, y: normalizedY },
    });
  };

  // 마우스 이벤트
  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      // 마우스 버튼이 눌려있을 때만
      updateAim(e.clientX, e.clientY);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    updateAim(e.clientX, e.clientY);
  };

  // 터치 이벤트
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    updateAim(touch.clientX, touch.clientY);
  };

  const throwDart = () => {
    socket.emit("throw", {
      room,
      playerId: "p1",
      power: Math.random(),
      aim: aim,
    });
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Room 입력 */}
      <div style={{ padding: 20, background: "#222" }}>
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value.toUpperCase())}
          style={{
            padding: 10,
            fontSize: 18,
            width: 200,
            marginRight: 10,
            borderRadius: 4,
            border: "none",
          }}
        />
        <button
          onClick={throwDart}
          style={{
            padding: 10,
            fontSize: 18,
            background: "#ff4444",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          🎯 던지기
        </button>
      </div>

      {/* 조준 영역 */}
      <div
        ref={aimAreaRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchMove}
        onTouchMove={handleTouchMove}
        style={{
          flex: 1,
          background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
          position: "relative",
          cursor: "crosshair",
          touchAction: "none",
        }}
      >
        {/* 조준점 표시 */}
        <div
          style={{
            position: "absolute",
            left: `${aim.x * 100}%`,
            top: `${aim.y * 100}%`,
            transform: "translate(-50%, -50%)",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(255, 68, 68, 0.8)",
            border: "3px solid white",
            boxShadow: "0 0 20px rgba(255, 68, 68, 0.6)",
            pointerEvents: "none",
          }}
        />

        {/* 십자선 */}
        <div
          style={{
            position: "absolute",
            left: `${aim.x * 100}%`,
            top: 0,
            bottom: 0,
            width: 1,
            background: "rgba(255, 255, 255, 0.3)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: `${aim.y * 100}%`,
            left: 0,
            right: 0,
            height: 1,
            background: "rgba(255, 255, 255, 0.3)",
            pointerEvents: "none",
          }}
        />

        {/* 좌표 표시 */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            color: "white",
            fontSize: 14,
            background: "rgba(0, 0, 0, 0.5)",
            padding: "10px 15px",
            borderRadius: 4,
          }}
        >
          X: {(aim.x * 100).toFixed(1)}% | Y: {(aim.y * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
