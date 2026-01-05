"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useMobileSocket } from "@/hooks/useMobileSocket";

type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "joined"
  | "waiting-display"
  | "ready"
  | "rejected";

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
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    "idle"
  );
  const [nameError, setNameError] = useState("");

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${msg}`);
  }, []);

  const emitRef = useRef<(aim: { x: number; y: number }, skin?: string) => void>(
    () => {}
  );

  const { emitAimUpdate } = useMobileSocket({
    room: shouldConnect ? room : "",
    customName,
    onLog: addLog,
    onSetPlayerCount: setPlayerCount,
    onSetIsRoomFull: setIsRoomFull,
    onSetIsRejected: setIsRejected,
    onConnected: () => setConnectionState("connected"),
    onJoined: (data) => {
      addLog(
        `Joined room with ${Math.max(0, data.playerCount - 1)} other players`
      );
      setConnectionState("joined");

      if (selectedMode === "solo") {
        setConnectionState("ready");
        emitRef.current({ x: 888, y: 888 });
        addLog(`Solo mode selected: ${customName}`);
      } else if (selectedMode === "duo") {
        setConnectionState("waiting-display");
        emitRef.current({ x: 999, y: 999 });
        addLog(`Duo mode selected: ${customName} (waiting for display)`);
      }
    },
    onTurnUpdate: (currentTurn) => {
      if (selectedMode === "duo" && currentTurn) {
        setConnectionState("ready");
      }
    },
  });

  useEffect(() => {
    emitRef.current = emitAimUpdate;
  }, [emitAimUpdate]);

  useEffect(() => {
    if (shouldConnect) {
      addLog(`Room: ${room}`);
      setConnectionState((prev) => (prev === "idle" ? "connecting" : prev));
    }
  }, [room, shouldConnect, addLog]);

  useEffect(() => {
    if (isRoomFull || isRejected) {
      setConnectionState("rejected");
    }
  }, [isRoomFull, isRejected]);

  const handleModeSelect = (mode: "solo" | "duo") => {
    if (!customName) {
      addLog("이름을 먼저 입력해주세요");
      setNameError("이름을 입력하면 시작할 수 있어요");
      return;
    }

    setNameError("");
    setShouldConnect(true);
    setSelectedMode(mode);
    setConnectionState("connecting");
  };

  const visiblePlayerCount = Math.max(0, playerCount - 1);
  const statusMessage = (() => {
    if (isRoomFull) {
      return isRejected
        ? "현재 혼자하기 모드로 진행 중입니다."
        : "최대 인원이 가득 찼습니다.";
    }
    if (selectedMode === "duo" && connectionState === "waiting-display") {
      return "디스플레이에서 준비를 확인 중입니다. 잠시만 기다려주세요.";
    }
    if (connectionState === "connecting") return "소켓에 연결 중...";
    if (connectionState === "connected") return "방 참여를 시도하는 중...";
    if (connectionState === "joined" && selectedMode === "duo")
      return "둘이서 하기 준비 신호를 보냈습니다.";
    if (connectionState === "ready" && selectedMode === "solo")
      return "혼자하기 준비 완료! 바로 시작하세요.";
    if (connectionState === "ready" && selectedMode === "duo")
      return "둘이서 하기 준비 완료!";
    return "";
  })();

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
            현재 인원: {visiblePlayerCount}명
          </div>
          {statusMessage && (
            <div
              style={{
                fontSize: "13px",
                opacity: 0.7,
                marginTop: "12px",
                lineHeight: 1.5,
              }}
            >
              {statusMessage}
            </div>
          )}
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
                현재 방 인원: {visiblePlayerCount}명
              </div>
            )}
            {nameError && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#ffdddd",
                  textAlign: "center",
                  opacity: 0.8,
                }}
              >
                {nameError}
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
      {statusMessage && selectedMode === null && (
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            color: "white",
            fontSize: "14px",
            opacity: 0.9,
            textAlign: "center",
            padding: "10px 16px",
            background: "rgba(0,0,0,0.4)",
            borderRadius: "12px",
            maxWidth: "320px",
            lineHeight: 1.5,
          }}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}
