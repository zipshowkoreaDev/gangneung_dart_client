"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { socket } from "@/shared/socket";

export default function MobilePage() {
  const [room, setRoom] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [skin, setSkin] = useState<"red" | "blue" | "yellow">("red");
  const [status, setStatus] = useState("대기중");
  const [isReady, setIsReady] = useState(false);
  const [aim, setAim] = useState({ x: 0, y: 0 }); // -1..1 범위

  // 센서 관련 ref
  const sensorsActiveRef = useRef(false);
  const aimReadyRef = useRef(false);
  const lastAimSentRef = useRef(0);
  const aimBlockedUntilRef = useRef(0);

  // 던지기 감지 관련 ref
  const armedAtRef = useRef(0);
  const baselineSumRef = useRef(0);
  const baselineSamplesRef = useRef(0);
  const prevMagRef = useRef(0);
  const accPeakRef = useRef(0);
  const gravityZRef = useRef(0);
  const readyRef = useRef(false);

  // 상수
  const ARMING_MS = 600;
  const MAG_THRESH = 18;
  const JERK_THRESH = 8;
  const AIM_HZ = 30;
  const AIM_INTERVAL = 1000 / AIM_HZ;

  // URL 파라미터에서 room 읽기
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    setRoom(roomParam || "DEMO");
    setPlayerName(`Player${Math.floor(Math.random() * 1000)}`);
  }, []);

  // 센서 중지
  const stopSensors = useCallback(() => {
    if (!sensorsActiveRef.current) return;

    sensorsActiveRef.current = false;
    readyRef.current = false;
    setIsReady(false);

    if (handleOrientationRef.current) {
      window.removeEventListener(
        "deviceorientation",
        handleOrientationRef.current
      );
      handleOrientationRef.current = null;
    }

    if (handleMotionRef.current) {
      window.removeEventListener("devicemotion", handleMotionRef.current);
      handleMotionRef.current = null;
    }

    socket.emit("aim-off", {
      room,
      name: playerName,
    });

    setStatus("대기중");
  }, [room, playerName]);

  // 소켓 연결
  useEffect(() => {
    if (!room) return;

    console.log("🔌 Connecting to socket...");
    socket.connect();

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err);
    });

    socket.emit("join-room", { room });

    return () => {
      stopSensors();
      socket.disconnect();
    };
  }, [room, stopSensors]);

  // 정규화 함수 (-1..1 범위로 맵핑)
  const norm = (v: number, a: number, b: number) => {
    return Math.max(-1, Math.min(1, ((v - a) / (b - a)) * 2 - 1));
  };

  // iOS 모션 권한 요청
  const requestMotionPermission = async () => {
    try {
      // iOS 13+ DeviceMotionEvent 권한 요청
      if (
        typeof DeviceMotionEvent !== "undefined" &&
        "requestPermission" in DeviceMotionEvent &&
        typeof DeviceMotionEvent.requestPermission === "function"
      ) {
        const motionPermission = await DeviceMotionEvent.requestPermission();
        if (motionPermission !== "granted") {
          alert("모션 권한이 거부되었습니다");
          return false;
        }
      }

      // iOS 13+ DeviceOrientationEvent 권한 요청
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        "requestPermission" in DeviceOrientationEvent &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const orientationPermission =
          await DeviceOrientationEvent.requestPermission();
        if (orientationPermission !== "granted") {
          alert("방향 권한이 거부되었습니다");
          return false;
        }
      }

      alert("모션 권한이 허용되었습니다!");
      return true;
    } catch (e) {
      alert(`권한 요청 실패: ${e}`);
      return false;
    }
  };

  // 이벤트 핸들러 ref 저장
  const handleOrientationRef = useRef<
    ((e: DeviceOrientationEvent) => void) | null
  >(null);
  const handleMotionRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  // 센서 시작
  const startSensors = () => {
    if (sensorsActiveRef.current) return;

    console.log("🎯 Starting sensors...");
    sensorsActiveRef.current = true;
    readyRef.current = true;
    accPeakRef.current = 0;
    // eslint-disable-next-line react-hooks/purity
    armedAtRef.current = performance.now();
    baselineSumRef.current = 0;
    baselineSamplesRef.current = 0;
    prevMagRef.current = 0;
    aimReadyRef.current = false;
    setIsReady(true);
    setStatus("조준 중... 앞으로 휘두르면 던집니다.");

    // 방 재보장
    console.log("🚪 Joining room:", room);
    socket.emit("join-room", { room });

    // DeviceOrientation: 기울기 → 조준
    // eslint-disable-next-line react-hooks/immutability
    handleOrientationRef.current = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0; // 좌우 -90..90
      const b = e.beta ?? 0; // 앞뒤 -180..180

      // 기본 맵핑
      const xNorm = -norm(g, -45, 45); // 좌우 반전
      const yNorm = norm(b, 10, 80);

      // face-up/face-down 판별하여 y축 반전
      const faceUp =
        Math.abs(gravityZRef.current) > 4 && gravityZRef.current < 0;
      const finalX = xNorm;
      const finalY = faceUp ? -yNorm : yNorm;

      setAim({ x: finalX, y: finalY });
      aimReadyRef.current = true;

      // 30Hz로 aim-update 전송
      const now = performance.now();
      if (
        (readyRef.current || sensorsActiveRef.current) &&
        now - lastAimSentRef.current > AIM_INTERVAL &&
        now >= aimBlockedUntilRef.current
      ) {
        lastAimSentRef.current = now;
        const payload = {
          room,
          playerId: playerName,
          name: playerName,
          skin,
          aim: { x: finalX, y: finalY },
        };
        console.log("🎯 Sending aim-update:", payload);
        socket.emit("aim-update", payload);
      }
    };

    // DeviceMotion: 가속도 → 파워(던지기 트리거)
    // eslint-disable-next-line react-hooks/immutability
    handleMotionRef.current = (e: DeviceMotionEvent) => {
      const ag = e.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
      gravityZRef.current = ag.z || 0;

      const a = e.acceleration || ag;
      const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
      const now = performance.now();

      // Arming 단계 (초기 600ms 동안 baseline 수집)
      if (now - armedAtRef.current < ARMING_MS) {
        baselineSumRef.current += mag;
        baselineSamplesRef.current++;
        prevMagRef.current = mag;
        return;
      }

      const baseline = baselineSamplesRef.current
        ? baselineSumRef.current / baselineSamplesRef.current
        : 0;
      const magAdj = Math.max(0, mag - baseline);
      const jerk = mag - prevMagRef.current;
      prevMagRef.current = mag;

      accPeakRef.current = Math.max(accPeakRef.current, magAdj);

      // 던지기 감지
      if (
        readyRef.current &&
        aimReadyRef.current &&
        magAdj > MAG_THRESH &&
        jerk > JERK_THRESH
      ) {
        throwDart();
      }
    };

    if (handleOrientationRef.current) {
      window.addEventListener(
        "deviceorientation",
        handleOrientationRef.current
      );
    }
    if (handleMotionRef.current) {
      window.addEventListener("devicemotion", handleMotionRef.current);
    }
  };

  // 던지기
  const throwDart = () => {
    if (!readyRef.current) return;
    readyRef.current = false;

    // 파워 계산 (0..1)
    const power = Math.max(0, Math.min(1, accPeakRef.current / 25));

    const payload = {
      room,
      playerId: playerName,
      name: playerName,
      skin,
      aim: { x: aim.x, y: aim.y },
      power,
    };

    console.log("🎲 Throwing dart:", payload);
    socket.emit("throw", payload);
    setStatus(
      `던짐! power=${power.toFixed(2)} aim=(${aim.x.toFixed(
        2
      )}, ${aim.y.toFixed(2)})`
    );

    // 던지기 직후 크로스헤어 숨김
    console.log("❌ Hiding aim");
    socket.emit("aim-off", {
      room,
      name: playerName,
    });

    // 1200ms 동안 aim-update 전송 차단
    aimBlockedUntilRef.current = performance.now() + 1200;

    // 센서 리셋
    accPeakRef.current = 0;
    baselineSumRef.current = 0;
    baselineSamplesRef.current = 0;
    prevMagRef.current = 0;
    aimReadyRef.current = false;

    // 500ms 후 자동 재준비
    setTimeout(() => {
      if (sensorsActiveRef.current) {
        readyRef.current = true;
        armedAtRef.current = performance.now();
        baselineSumRef.current = 0;
        baselineSamplesRef.current = 0;
        prevMagRef.current = 0;
        aimReadyRef.current = false;
        setStatus("조준 중... 앞으로 휘두르면 던집니다.");
      }
    }, 500);

    // 1200ms 후 크로스헤어 다시 표시
    setTimeout(() => {
      if (sensorsActiveRef.current) {
        socket.emit("aim-update", {
          room,
          playerId: playerName,
          name: playerName,
          skin,
          aim: { x: aim.x, y: aim.y },
        });
      }
    }, 1200);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0a0e27",
        color: "white",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* 상단 컨트롤 */}
      <div
        style={{
          padding: "20px",
          background: "rgba(255, 255, 255, 0.05)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Room & Name */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <input
            placeholder="ROOM"
            value={room}
            onChange={(e) => setRoom(e.target.value.toUpperCase())}
            style={{
              flex: 1,
              padding: "12px",
              fontSize: "16px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: "rgba(255, 255, 255, 0.05)",
              color: "white",
            }}
          />
          <input
            placeholder="이름"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
            style={{
              flex: 1,
              padding: "12px",
              fontSize: "16px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: "rgba(255, 255, 255, 0.05)",
              color: "white",
            }}
          />
        </div>

        {/* 스킨 선택 */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "15px",
          }}
        >
          {(["red", "blue", "yellow"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSkin(s)}
              style={{
                flex: 1,
                padding: "12px",
                fontSize: "16px",
                borderRadius: "8px",
                border:
                  skin === s
                    ? "2px solid white"
                    : "1px solid rgba(255, 255, 255, 0.2)",
                background:
                  s === "red"
                    ? "#ff4d4d"
                    : s === "blue"
                    ? "#4da3ff"
                    : "#ffd24d",
                color: "white",
                cursor: "pointer",
                fontWeight: skin === s ? "bold" : "normal",
              }}
            >
              {s === "red" ? "🔴" : s === "blue" ? "🔵" : "🟡"}{" "}
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {/* iOS 권한 요청 */}
        <button
          onClick={requestMotionPermission}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "14px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            background: "rgba(255, 255, 255, 0.1)",
            color: "white",
            cursor: "pointer",
            marginBottom: "10px",
          }}
        >
          📱 iOS 모션 권한 요청
        </button>

        {/* 조준 시작/중지 */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={startSensors}
            disabled={isReady}
            style={{
              flex: 1,
              padding: "16px",
              fontSize: "18px",
              borderRadius: "8px",
              border: "none",
              background: isReady
                ? "rgba(100, 100, 100, 0.5)"
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              cursor: isReady ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            🎯 조준 시작
          </button>
          <button
            onClick={stopSensors}
            disabled={!isReady}
            style={{
              flex: 1,
              padding: "16px",
              fontSize: "18px",
              borderRadius: "8px",
              border: "none",
              background: !isReady
                ? "rgba(100, 100, 100, 0.5)"
                : "rgba(255, 68, 68, 0.8)",
              color: "white",
              cursor: !isReady ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            ❌ 중지
          </button>
        </div>
      </div>

      {/* 상태 표시 */}
      <div
        style={{
          padding: "15px 20px",
          background: "rgba(255, 255, 255, 0.05)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          fontSize: "14px",
          textAlign: "center",
        }}
      >
        <strong>상태:</strong> {status}
      </div>

      {/* 시각적 피드백 영역 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
        }}
      >
        {/* 조준점 시각화 */}
        {isReady && (
          <>
            {/* 배경 그리드 */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: "1px",
                background: "rgba(255, 255, 255, 0.2)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                bottom: 0,
                width: "1px",
                background: "rgba(255, 255, 255, 0.2)",
              }}
            />

            {/* 조준점 */}
            <div
              style={{
                position: "absolute",
                left: `${50 + aim.x * 45}%`,
                top: `${50 + aim.y * 45}%`,
                transform: "translate(-50%, -50%)",
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                border: "4px solid rgba(255, 68, 68, 0.9)",
                background: "rgba(255, 68, 68, 0.3)",
                boxShadow: "0 0 30px rgba(255, 68, 68, 0.6)",
                transition: "all 0.05s ease-out",
              }}
            />

            {/* 중심점 */}
            <div
              style={{
                position: "absolute",
                left: `${50 + aim.x * 45}%`,
                top: `${50 + aim.y * 45}%`,
                transform: "translate(-50%, -50%)",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#ff4444",
              }}
            />

            {/* 좌표 표시 */}
            <div
              style={{
                position: "absolute",
                bottom: "20px",
                left: "20px",
                background: "rgba(0, 0, 0, 0.6)",
                padding: "10px 15px",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            >
              X: {aim.x.toFixed(2)} | Y: {aim.y.toFixed(2)}
            </div>
          </>
        )}

        {!isReady && (
          <div
            style={{
              textAlign: "center",
              opacity: 0.6,
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "20px" }}>🎯</div>
            <div style={{ fontSize: "18px" }}>조준 시작 버튼을 눌러주세요</div>
            <div style={{ fontSize: "14px", marginTop: "10px", opacity: 0.7 }}>
              기기를 기울여 조준하고
              <br />
              앞으로 휘두르면 던집니다
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
