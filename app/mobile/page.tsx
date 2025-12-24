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
  const [playerId, setPlayerId] = useState("");
  const [skin] = useState<Skin>("red");
  const [status, setStatus] = useState("대기중");
  const [isReady, setIsReady] = useState(false);
  const [aim, setAim] = useState({ x: 0, y: 0 }); // -1..1
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socketUrl, setSocketUrl] = useState("");

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

  /* -------------------- debug log -------------------- */
  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev.slice(-20), `[${timestamp}] ${msg}`]);
  }, []);

  /* -------------------- init -------------------- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("room") || "DEMO";
    setRoom(r.toUpperCase());
    setPlayerId(`Player${Math.floor(Math.random() * 1000)}`);
    addLog(
      `Room: ${r.toUpperCase()}, Player: Player${Math.floor(
        Math.random() * 1000
      )}`
    );
  }, [addLog]);

  /* -------------------- socket -------------------- */
  useEffect(() => {
    if (!room) return;

    // Socket URL 저장
    const url = `${window.location.protocol}//${window.location.host}`;
    setSocketUrl(url);

    addLog(`소켓 연결 시도 중... (${url})`);
    socket.connect();

    socket.on("connect", () => {
      setIsConnected(true);
      addLog(`✅ 소켓 연결 성공: ${socket.id}`);
      socket.emit("join-room", {
        room,
        role: "mobile",
        playerId,
      });
      addLog(`🚪 Room 참가: ${room}`);
    });

    socket.on("connect_error", (err) => {
      setIsConnected(false);
      addLog(`❌ 연결 에러: ${err.message}`);
      console.error("❌ socket error:", err);
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      addLog(`⚠️ 연결 끊김: ${reason}`);
    });

    return () => {
      stopSensors();
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, playerId, addLog]);

  /* -------------------- utils -------------------- */
  const norm = (v: number, a: number, b: number) =>
    Math.max(-1, Math.min(1, ((v - a) / (b - a)) * 2 - 1));

  /* -------------------- permission -------------------- */
  const requestMotionPermission = async (): Promise<boolean> => {
    try {
      // 플랫폼 감지
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      addLog(`플랫폼: ${isIOS ? "iOS" : "Android/기타"}`);

      // iOS 13+ 권한 요청
      if (
        typeof DeviceMotionEvent !== "undefined" &&
        "requestPermission" in DeviceMotionEvent
      ) {
        addLog("DeviceMotionEvent 권한 요청 중...");
        const DeviceMotion =
          DeviceMotionEvent as unknown as DeviceMotionEventiOS;
        if (DeviceMotion.requestPermission) {
          const result = await DeviceMotion.requestPermission();
          addLog(`DeviceMotionEvent 권한 결과: ${result}`);
          if (result !== "granted") {
            addLog("❌ 모션 권한 거부됨");
            return false;
          }
        }
      } else {
        addLog("DeviceMotionEvent 권한 불필요 (Android 또는 구형 iOS)");
      }

      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        "requestPermission" in DeviceOrientationEvent
      ) {
        addLog("DeviceOrientationEvent 권한 요청 중...");
        const DeviceOrientation =
          DeviceOrientationEvent as unknown as DeviceOrientationEventiOS;
        if (DeviceOrientation.requestPermission) {
          const result = await DeviceOrientation.requestPermission();
          addLog(`DeviceOrientationEvent 권한 결과: ${result}`);
          if (result !== "granted") {
            addLog("❌ 방향 권한 거부됨");
            return false;
          }
        }
      } else {
        addLog("DeviceOrientationEvent 권한 불필요");
      }

      addLog("✅ 모든 권한 허용됨");
      return true;
    } catch (e) {
      addLog(`❌ 권한 요청 오류: ${e}`);
      return false;
    }
  };

  /* -------------------- stop sensors -------------------- */
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
      playerId,
    });

    setStatus("대기중");
  }, [room, playerId]);

  /* -------------------- start sensors -------------------- */
  const startSensors = () => {
    if (sensorsActiveRef.current) return;

    addLog("🎮 센서 시작");
    sensorsActiveRef.current = true;
    readyRef.current = true;
    setIsReady(true);
    setStatus("조준 중… 앞으로 휘두르면 던집니다.");

    accPeakRef.current = 0;
    armedAtRef.current = performance.now();
    baselineSumRef.current = 0;
    baselineSamplesRef.current = 0;
    prevMagRef.current = 0;
    aimReadyRef.current = false;

    /* orientation → aim */
    let orientationCount = 0;
    handleOrientationRef.current = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0;
      const b = e.beta ?? 0;

      const x = norm(g, -45, 45);
      const y0 = norm(b, 10, 80);
      const faceUp =
        Math.abs(gravityZRef.current) > 4 && gravityZRef.current < 0;
      const y = faceUp ? y0 : -y0;

      setAim({ x, y });
      aimReadyRef.current = true;

      // 처음 이벤트 발생 로그
      orientationCount++;
      if (orientationCount === 1) {
        addLog(
          `📱 자이로 이벤트 발생! gamma=${g.toFixed(1)}, beta=${b.toFixed(1)}`
        );
      }

      const now = performance.now();
      if (
        readyRef.current &&
        now - lastAimSentRef.current > AIM_INTERVAL &&
        now >= aimBlockedUntilRef.current
      ) {
        lastAimSentRef.current = now;
        socket.emit("aim-update", {
          room,
          playerId,
          skin,
          aim: { x, y },
        });
        // 처음 한 번만 로그 (너무 많이 찍히지 않도록)
        if (now - armedAtRef.current < 2000) {
          addLog(`📡 aim-update 전송 (room=${room}, player=${playerId})`);
        }
      }
    };

    /* motion → throw */
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

    addLog("🔧 이벤트 리스너 등록 시작...");
    window.addEventListener("deviceorientation", handleOrientationRef.current);
    window.addEventListener("devicemotion", handleMotionRef.current);
    addLog("✅ 이벤트 리스너 등록 완료");

    // 2초 후에도 이벤트가 없으면 경고
    setTimeout(() => {
      if (orientationCount === 0) {
        addLog("⚠️ 자이로 이벤트가 발생하지 않음! 권한을 확인하세요.");
      }
    }, 2000);
  };

  /* -------------------- throw -------------------- */
  const throwDart = () => {
    if (!readyRef.current) return;
    readyRef.current = false;

    const power = Math.max(0, Math.min(1, accPeakRef.current / 25));

    addLog(`🎯 다트 던짐! power=${power.toFixed(2)}`);
    socket.emit("throw", {
      room,
      playerId,
      skin,
      aim,
      power,
    });

    setStatus(
      `던짐! power=${power.toFixed(2)} aim=(${aim.x.toFixed(
        2
      )}, ${aim.y.toFixed(2)})`
    );

    socket.emit("aim-off", { room, playerId });
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
        setStatus("조준 중… 앞으로 휘두르면 던집니다.");
      }
    }, 500);
  };

  const handleStart = async () => {
    addLog("🔑 모션 권한 요청 중...");
    const ok = await requestMotionPermission();
    if (!ok) {
      addLog("❌ 모션 권한 거부됨");
      return;
    }
    addLog("✅ 모션 권한 허용됨");
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
      {/* 디버그 패널 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "rgba(0, 0, 0, 0.85)",
          color: "#fff",
          padding: "8px 12px",
          fontSize: "11px",
          fontFamily: "monospace",
          maxHeight: "40vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{ marginBottom: "4px", fontWeight: "bold", fontSize: "12px" }}
        >
          🔧 디버그 정보
        </div>
        <div style={{ marginBottom: "4px" }}>
          연결 상태: {isConnected ? "🟢 연결됨" : "🔴 연결 안됨"}
        </div>
        <div style={{ marginBottom: "4px" }}>Room: {room || "없음"}</div>
        <div style={{ marginBottom: "4px" }}>Player: {playerId || "없음"}</div>
        <div style={{ marginBottom: "4px" }}>
          Socket URL: {socketUrl || "N/A"}
        </div>
        <div
          style={{
            marginTop: "8px",
            borderTop: "1px solid #444",
            paddingTop: "4px",
          }}
        >
          <strong>로그:</strong>
          {debugLogs.length === 0 && (
            <div style={{ opacity: 0.6 }}>로그 없음</div>
          )}
          {debugLogs.map((log, idx) => (
            <div key={idx} style={{ fontSize: "10px", opacity: 0.9 }}>
              {log}
            </div>
          ))}
        </div>
      </div>
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
          {/* 다트가 세로로 서있다는 전제: 필요시 rotation/scale 조절 */}
          <group position={[0, -0.2, 0]} scale={1.1}>
            <DartPreview />
          </group>
        </Canvas>
      </div>

      {/* ✅ 기존 UI(조준점/가이드)는 위로 */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
        }}
      >
        {/* 여기부터는 너의 기존 isReady 분기 UI 그대로 두면 됨 */}
        {isReady && (
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 50,
              background: "rgba(0, 0, 0, 0.8)",
              color: "white",
              padding: "12px 20px",
              borderRadius: 8,
              fontFamily: "monospace",
              fontSize: "14px",
              textAlign: "center",
            }}
          >
            <div>
              조준: ({aim.x.toFixed(2)}, {aim.y.toFixed(2)})
            </div>
            <div style={{ fontSize: "12px", opacity: 0.8, marginTop: "4px" }}>
              {status}
            </div>
          </div>
        )}

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
            <div style={{ fontSize: "18px", fontWeight: 600 }}>
              휴대폰을 기울여 조준하세요
            </div>

            <div style={{ fontSize: "14px", opacity: 0.7, lineHeight: 1.5 }}>
              화면에 보이는 다트는 회전 중입니다.
              <br />
              시작을 누르면 조준이 디스플레이에 표시됩니다.
            </div>

            {/* ✅ 시작 버튼 */}
            <button
              onClick={handleStart}
              style={{
                marginTop: "12px",
                padding: "16px 28px",
                fontSize: "18px",
                fontWeight: "bold",
                borderRadius: "999px",
                border: "none",
                background: "linear-gradient(135deg, #ff7a18 0%, #ff3d00 100%)",
                color: "white",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              }}
            >
              시작
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
