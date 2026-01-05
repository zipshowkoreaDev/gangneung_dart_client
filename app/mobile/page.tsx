"use client";

import { useEffect, useState, useCallback } from "react";
import { useMobileSocket } from "@/hooks/useMobileSocket";

export default function MobilePage() {
  const [room] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const roomFromUrl = urlParams.get("room");
      return roomFromUrl || "zipshow";
    }
    return "zipshow";
  });
  const [customName, setCustomName] = useState("");
  const [playerCount, setPlayerCount] = useState(0);
  const [isRoomFull, setIsRoomFull] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"solo" | "duo" | null>(null);
  const [shouldConnect, setShouldConnect] = useState(false);

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${msg}`);
  }, []);

  const { emitAimUpdate } = useMobileSocket({
    room: shouldConnect ? room : "",
    customName,
    onLog: addLog,
    onSetPlayerCount: setPlayerCount,
    onSetIsRoomFull: setIsRoomFull,
    onSetIsRejected: setIsRejected,
  });

  useEffect(() => {
    if (shouldConnect) {
      addLog(`Room: ${room}`);
    }
  }, [room, shouldConnect, addLog]);

  const handleModeSelect = (mode: "solo" | "duo") => {
    if (!customName) {
      addLog("이름을 먼저 입력해주세요");
      return;
    }

    setShouldConnect(true);
    setSelectedMode(mode);

    setTimeout(() => {
      if (mode === "solo") {
        emitAimUpdate({ x: 888, y: 888 });
        addLog(`Solo mode selected: ${customName}`);
      } else {
        emitAimUpdate({ x: 999, y: 999 });
        addLog(`Duo mode selected: ${customName}`);
      }
    }, 500);
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "32px",
        background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
        padding: "0 20px",
      }}
    >
      {isRoomFull ? (
        <div
          style={{
            textAlign: "center",
            color: "white",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#ff3d00",
              marginBottom: "16px",
            }}
          >
            {isRejected ? "입장이 거부되었습니다" : "방이 가득 찼습니다"}
          </div>
          <div style={{ fontSize: "14px", opacity: 0.7, lineHeight: 1.5 }}>
            {isRejected ? (
              <>
                현재 혼자하기 모드로 게임이 진행 중입니다.
                <br />
                다른 방에 입장해주세요.
              </>
            ) : (
              <>
                최대 2명까지만 참가할 수 있습니다.
                <br />
                다른 플레이어가 나갈 때까지 기다려주세요.
              </>
            )}
          </div>
        </div>
      ) : selectedMode ? (
        <div
          style={{
            textAlign: "center",
            color: "white",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              marginBottom: "16px",
            }}
          >
            {selectedMode === "solo" ? "혼자하기" : "둘이서 하기"} 모드
          </div>
          <div style={{ fontSize: "16px", opacity: 0.8 }}>
            플레이어: {customName}
          </div>
          <div style={{ fontSize: "14px", opacity: 0.6, marginTop: "8px" }}>
            현재 인원: {playerCount}명
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "white",
              textAlign: "center",
            }}
          >
            다트 게임
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              width: "100%",
              maxWidth: "300px",
            }}
          >
            <input
              type="text"
              value={customName}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= 5) {
                  setCustomName(value);
                }
              }}
              placeholder="이름 입력 (최대 5글자)"
              maxLength={5}
              style={{
                padding: "16px",
                fontSize: "18px",
                fontWeight: "600",
                borderRadius: "12px",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                background: "rgba(255, 255, 255, 0.1)",
                color: "white",
                textAlign: "center",
                outline: "none",
                backdropFilter: "blur(10px)",
              }}
            />

            {shouldConnect && (
              <div
                style={{
                  fontSize: "14px",
                  color: "white",
                  opacity: 0.7,
                  textAlign: "center",
                }}
              >
                현재 방 인원: {playerCount}명
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              width: "100%",
              maxWidth: "300px",
            }}
          >
            <button
              onClick={() => handleModeSelect("solo")}
              disabled={!customName}
              style={{
                padding: "20px 40px",
                fontSize: "24px",
                fontWeight: "bold",
                borderRadius: "16px",
                border: "none",
                background: !customName
                  ? "#888"
                  : "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                color: !customName ? "#ccc" : "#000",
                cursor: !customName ? "not-allowed" : "pointer",
                boxShadow: !customName
                  ? "none"
                  : "0 8px 32px rgba(255, 215, 0, 0.4)",
                opacity: !customName ? 0.5 : 1,
                transition: "all 0.3s ease",
              }}
            >
              혼자
            </button>

            <button
              onClick={() => handleModeSelect("duo")}
              disabled={!customName}
              style={{
                padding: "20px 40px",
                fontSize: "24px",
                fontWeight: "bold",
                borderRadius: "16px",
                border: "none",
                background: !customName
                  ? "#888"
                  : "linear-gradient(135deg, #4CAF50 0%, #45a049 100%)",
                color: "white",
                cursor: !customName ? "not-allowed" : "pointer",
                boxShadow: !customName
                  ? "none"
                  : "0 8px 32px rgba(76, 175, 80, 0.4)",
                opacity: !customName ? 0.5 : 1,
                transition: "all 0.3s ease",
              }}
            >
              둘이서
            </button>
          </div>
        </>
      )}
    </div>
  );
}
