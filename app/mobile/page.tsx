"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { socket } from "@/shared/socket";
import { Canvas } from "@react-three/fiber";
import DartPreview from "@/three/DartPreview";

type Skin = "red" | "blue" | "yellow";

// iOS DeviceMotion/Orientation 권한 타입
type PermissionState = "granted" | "denied" | "default";

interface DeviceMotionEventiOS {
  requestPermission?: () => Promise<PermissionState>;
}

interface DeviceOrientationEventiOS {
  requestPermission?: () => Promise<PermissionState>;
}

export default function MobilePage() {
  const [room, setRoom] = useState("");
  const [customName, setCustomName] = useState(""); // 사용자 입력 이름 (필수)

  const [isReady, setIsReady] = useState(false);
  const [isThrowing, setIsThrowing] = useState(false);
  const [isRoomFull, setIsRoomFull] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [isSoloMode, setIsSoloMode] = useState(false);
  const [isRejected, setIsRejected] = useState(false);

  /* -------------------- refs -------------------- */
  const sensorsActiveRef = useRef(false);
  const readyRef = useRef(false);
  const aimReadyRef = useRef(false);

  const lastAimSentRef = useRef(0);
  const aimBlockedUntilRef = useRef(0);

  const armedAtRef = useRef(0);
  const baselineSumRef = useRef(0);
  const baselineSamplesRef = useRef(0);
  const prevMagRef = useRef(0);
  const accPeakRef = useRef(0);
  const gravityZRef = useRef(0);

  const skin: Skin = "red"; // 임시 고정

  // 던지는 순간의 정확한 aim 좌표를 저장
  const aimRef = useRef({ x: 0, y: 0 });

  const handleOrientationRef = useRef<
    ((e: DeviceOrientationEvent) => void) | null
  >(null);
  const handleMotionRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  /* -------------------- constants -------------------- */
  const ARMING_MS = 600;
  const MAG_THRESH = 18;
  const JERK_THRESH = 8;
  const AIM_HZ = 30;
  const AIM_INTERVAL = 1000 / AIM_HZ;

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${msg}`);
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get("room");

    if (roomFromUrl) {
      setRoom(roomFromUrl);
      addLog(`Room from URL: ${roomFromUrl}`);
    } else {
      const r = "zipshow";
      setRoom(r);
      addLog(`Room fallback: ${r}`);
    }
  }, [addLog]);

  useEffect(() => {
    if (!room) return;

    socket.connect();

    socket.on("connect", () => {
      addLog(`Socket connected: ${socket.id}`);
      socket.emit("joinRoom", {
        room,
        name: customName,
      });
    });

    socket.on("connect_error", (err) => {
      addLog(`Connection error: ${err.message}`);
      console.error("Socket error:", err);
    });

    socket.on("disconnect", (reason) => {
      addLog(`Disconnected: ${reason}`);
    });

    socket.on(
      "clientInfo",
      (data: { socketId: string; name: string; room: string }) => {
        addLog(`Client info received: ${data.socketId}`);
      }
    );

    socket.on("joinedRoom", (data: { room: string; playerCount: number }) => {
      addLog(`Room joined: ${data.room}, Players: ${data.playerCount}`);

      if (data.playerCount > 3) {
        setIsRoomFull(true);
        addLog(`Room full: ${data.playerCount} players (max 3)`);
        socket.disconnect();
      }
    });

    socket.on(
      "roomPlayerCount",
      (data: { room: string; playerCount: number }) => {
        addLog(`Player count: ${data.playerCount}`);

        if (data.playerCount > 3 && !isRoomFull) {
          setIsRoomFull(true);
          addLog(`Room full: ${data.playerCount} players (max 3)`);
          socket.disconnect();
        }
      }
    );

    socket.on(
      "turn-update",
      (data: { room: string; currentTurn: string | null }) => {
        if (data.room !== room) return;

        const isMyTurnNow = data.currentTurn === customName;
        setIsMyTurn(isMyTurnNow);
        addLog(`Turn: ${data.currentTurn || "none"}${isMyTurnNow ? " (My turn)" : ""}`);
      }
    );

    socket.on("solo-mode-started", (data: { room: string; player: string }) => {
      if (data.room !== room) return;

      const isSoloPlayer = data.player === customName;
      setIsSoloMode(true);
      if (isSoloPlayer) {
        setIsMyTurn(true);
      }
      addLog(`Solo mode: ${data.player}${isSoloPlayer ? " (Me)" : ""}`);
    });

    socket.on(
      "player-rejected",
      (data: { room: string; name: string; reason: string }) => {
        if (data.room !== room || data.name !== customName) return;

        addLog(`Player rejected: ${data.reason}`);
        if (data.reason === "solo-mode") {
          setIsRejected(true);
          setIsRoomFull(true);
          socket.disconnect();
        }
      }
    );

    return () => {
      stopSensors();
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
      socket.off("clientInfo");
      socket.off("joinedRoom");
      socket.off("roomPlayerCount");
      socket.off("turn-update");
      socket.off("solo-mode-started");
      socket.off("player-rejected");

      if (process.env.NODE_ENV === "production") {
        socket.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, customName, addLog]);

  const norm = (v: number, a: number, b: number) =>
    Math.max(-1, Math.min(1, ((v - a) / (b - a)) * 2 - 1));

  const requestMotionPermission = async (): Promise<boolean> => {
    try {
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      addLog(`Platform: ${isIOS ? "iOS" : "Android"}`);

      if (
        typeof DeviceMotionEvent !== "undefined" &&
        "requestPermission" in DeviceMotionEvent
      ) {
        addLog("Requesting DeviceMotion permission...");
        const DeviceMotion =
          DeviceMotionEvent as unknown as DeviceMotionEventiOS;
        if (DeviceMotion.requestPermission) {
          const result = await DeviceMotion.requestPermission();
          addLog(`DeviceMotion permission: ${result}`);
          if (result !== "granted") {
            addLog("Motion permission denied");
            return false;
          }
        }
      }

      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        "requestPermission" in DeviceOrientationEvent
      ) {
        addLog("Requesting DeviceOrientation permission...");
        const DeviceOrientation =
          DeviceOrientationEvent as unknown as DeviceOrientationEventiOS;
        if (DeviceOrientation.requestPermission) {
          const result = await DeviceOrientation.requestPermission();
          addLog(`DeviceOrientation permission: ${result}`);
          if (result !== "granted") {
            addLog("Orientation permission denied");
            return false;
          }
        }
      }

      addLog("All permissions granted");
      return true;
    } catch (e) {
      addLog(`Permission error: ${e}`);
      return false;
    }
  };

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

    if (socket.connected && customName) {
      socket.emit("aim-off", {
        room,
        name: customName,
      });
    }
  }, [room, customName]);

  const startSensors = () => {
    if (sensorsActiveRef.current) return;

    addLog("Sensors started");
    sensorsActiveRef.current = true;
    readyRef.current = true;
    setIsReady(true);

    accPeakRef.current = 0;
    armedAtRef.current = performance.now();
    baselineSumRef.current = 0;
    baselineSamplesRef.current = 0;
    prevMagRef.current = 0;
    aimReadyRef.current = false;

    let orientationCount = 0;
    handleOrientationRef.current = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0;
      const b = e.beta ?? 0;

      const x = norm(g, -45, 45);
      const y0 = norm(b, 10, 80);
      const faceUp =
        Math.abs(gravityZRef.current) > 4 && gravityZRef.current < 0;
      const y = faceUp ? -y0 : y0;

      const aimValue = { x, y };
      aimRef.current = aimValue;
      aimReadyRef.current = true;

      orientationCount++;
      if (orientationCount === 1) {
        addLog(`Gyro active: gamma=${g.toFixed(1)}, beta=${b.toFixed(1)}`);
      }

      const now = performance.now();
      if (
        readyRef.current &&
        socket.connected &&
        customName &&
        now - lastAimSentRef.current > AIM_INTERVAL &&
        now >= aimBlockedUntilRef.current
      ) {
        lastAimSentRef.current = now;
        socket.emit("aim-update", {
          room,
          name: customName,
          skin,
          aim: { x, y },
        });
      }
    };

    handleMotionRef.current = (e: DeviceMotionEvent) => {
      const ag = e.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
      gravityZRef.current = ag.z || 0;

      const a = e.acceleration || ag;
      const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
      const now = performance.now();

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

      if (
        readyRef.current &&
        aimReadyRef.current &&
        magAdj > MAG_THRESH &&
        jerk > JERK_THRESH
      ) {
        throwDart();
      }
    };

    window.addEventListener("deviceorientation", handleOrientationRef.current);
    window.addEventListener("devicemotion", handleMotionRef.current);
    addLog("Event listeners registered");

    setTimeout(() => {
      if (orientationCount === 0) {
        addLog("Warning: No gyro events. Check permissions.");
      }
    }, 2000);
  };

  const throwDart = () => {
    if (!readyRef.current) return;
    if (!socket.connected) {
      addLog("Throw failed: Socket disconnected");
      return;
    }
    if (!customName) {
      addLog("Throw failed: No player name");
      return;
    }
    if (!isSoloMode && !isMyTurn) {
      addLog("Throw failed: Not your turn");
      return;
    }

    readyRef.current = false;

    const throwSound = new Audio("/sound/throw.mp3");
    throwSound.play().catch((e) => console.error("Sound play failed:", e));

    setIsThrowing(true);
    setTimeout(() => setIsThrowing(false), 1000);

    const power = Math.max(0, Math.min(1, accPeakRef.current / 25));
    const currentAim = aimRef.current;

    addLog(
      `Dart thrown: power=${power.toFixed(2)} aim=(${currentAim.x.toFixed(
        2
      )}, ${currentAim.y.toFixed(2)})`
    );
    socket.emit("throw-dart", {
      room,
      name: customName,
      aim: currentAim,
      score: Math.round(power * 100),
    });

    socket.emit("aim-off", { room, name: customName });
    aimBlockedUntilRef.current = performance.now() + 1200;

    accPeakRef.current = 0;
    baselineSumRef.current = 0;
    baselineSamplesRef.current = 0;
    prevMagRef.current = 0;
    aimReadyRef.current = false;

    setTimeout(() => {
      if (sensorsActiveRef.current) {
        readyRef.current = true;
        armedAtRef.current = performance.now();
      }
    }, 500);
  };

  const handleStart = async () => {
    addLog("Requesting motion permissions...");
    const ok = await requestMotionPermission();
    if (!ok) {
      addLog("Motion permissions denied");
      return;
    }
    addLog("Motion permissions granted");
    startSensors();
  };

  /* -------------------- UI -------------------- */
  return (
    // {/* 시각적 피드백 영역 */}
    <div
      style={{
        height: "100%",
        flex: 1,
        position: "relative",
        background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
        overflow: "hidden",
      }}
    >
      {/* ✅ 3D 다트 프리뷰 (배경처럼) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
        }}
      >
        <Canvas
          camera={{ position: [0, 0, 4], fov: 45 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true }}
        >
          <group position={[0, -0.2, 0]} scale={1.1}>
            <DartPreview show={isReady} throwing={isThrowing} />
          </group>
        </Canvas>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
        }}
      >
        {!isReady && (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "24px",
              textAlign: "center",
              padding: "0 20px",
            }}
          >
            {isRoomFull ? (
              <>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "#ff3d00",
                  }}
                >
                  {isRejected ? "입장이 거부되었습니다" : "방이 가득 찼습니다"}
                </div>
                <div
                  style={{ fontSize: "14px", opacity: 0.7, lineHeight: 1.5 }}
                >
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
              </>
            ) : (
              <>
                <div style={{ fontSize: "18px", fontWeight: 600 }}>
                  이름을 입력하세요
                </div>

                {/* 이름 입력 필드 */}
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => {
                    const value = e.target.value;
                    // 5글자 제한
                    if (value.length <= 5) {
                      setCustomName(value);
                    }
                  }}
                  placeholder="최대 5글자"
                  maxLength={5}
                  style={{
                    width: "200px",
                    padding: "12px 16px",
                    fontSize: "16px",
                    fontWeight: "500",
                    borderRadius: "8px",
                    border: "2px solid rgba(255, 255, 255, 0.3)",
                    background: "rgba(255, 255, 255, 0.1)",
                    color: "white",
                    textAlign: "center",
                    outline: "none",
                    backdropFilter: "blur(10px)",
                  }}
                />

                <div
                  style={{ fontSize: "14px", opacity: 0.7, lineHeight: 1.5 }}
                >
                  이름을 입력하고 시작 버튼을 누르세요.
                  <br />
                  휴대폰을 기울여 조준할 수 있습니다.
                </div>
              </>
            )}
          </div>
        )}

        {/* 시작/종료 버튼 - 항상 같은 위치 */}
        <button
          onClick={isReady ? stopSensors : handleStart}
          disabled={!isReady && (isRoomFull || !customName)}
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            padding: "16px 28px",
            fontSize: "18px",
            fontWeight: "bold",
            borderRadius: "999px",
            border: "none",
            background:
              !isReady && (isRoomFull || !customName)
                ? "#666"
                : isReady
                ? "linear-gradient(135deg, #666 0%, #444 100%)"
                : "linear-gradient(135deg, #ff7a18 0%, #ff3d00 100%)",
            color: "white",
            cursor:
              !isReady && (isRoomFull || !customName)
                ? "not-allowed"
                : "pointer",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            opacity: !isReady && (isRoomFull || !customName) ? 0.5 : 1,
          }}
        >
          {isReady ? "종료하기" : "시작"}
        </button>
      </div>
    </div>
  );
}
