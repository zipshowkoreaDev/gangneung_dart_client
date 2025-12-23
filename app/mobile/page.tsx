"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { socket } from "@/shared/socket";
import { Canvas } from "@react-three/fiber";
import DartPreview from "@/three/DartPreview";

type Skin = "red" | "blue" | "yellow";

export default function MobilePage() {
  const [room, setRoom] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [skin, setSkin] = useState<Skin>("red");
  const [status, setStatus] = useState("대기중");
  const [isReady, setIsReady] = useState(false);
  const [aim, setAim] = useState({ x: 0, y: 0 }); // -1..1

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

  /* -------------------- init -------------------- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("room") || "DEMO";
    setRoom(r.toUpperCase());
    setPlayerId(`Player${Math.floor(Math.random() * 1000)}`);
  }, []);

  /* -------------------- socket -------------------- */
  useEffect(() => {
    if (!room) return;

    socket.connect();

    socket.on("connect", () => {
      socket.emit("join-room", {
        room,
        role: "mobile",
        playerId,
      });
    });

    socket.on("connect_error", (err) => {
      console.error("❌ socket error:", err);
    });

    return () => {
      stopSensors();
      socket.off("connect");
      socket.off("connect_error");
      socket.disconnect();
    };
  }, [room, playerId]);

  /* -------------------- utils -------------------- */
  const norm = (v: number, a: number, b: number) =>
    Math.max(-1, Math.min(1, ((v - a) / (b - a)) * 2 - 1));

  /* -------------------- permission -------------------- */
  const requestMotionPermission = async (): Promise<boolean> => {
    try {
      if (
        typeof DeviceMotionEvent !== "undefined" &&
        "requestPermission" in DeviceMotionEvent
      ) {
        const r = await (DeviceMotionEvent as any).requestPermission();
        if (r !== "granted") {
          alert("모션 권한 거부됨");
          return false;
        }
      }

      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        "requestPermission" in DeviceOrientationEvent
      ) {
        const r = await (DeviceOrientationEvent as any).requestPermission();
        if (r !== "granted") {
          alert("방향 권한 거부됨");
          return false;
        }
      }

      alert("모션 권한 허용됨");
      return true;
    } catch (e) {
      alert(`권한 요청 실패: ${e}`);
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
    handleOrientationRef.current = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0;
      const b = e.beta ?? 0;

      const x = -norm(g, -45, 45);
      const y0 = norm(b, 10, 80);
      const faceUp =
        Math.abs(gravityZRef.current) > 4 && gravityZRef.current < 0;
      const y = faceUp ? -y0 : y0;

      setAim({ x, y });
      aimReadyRef.current = true;

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

    window.addEventListener("deviceorientation", handleOrientationRef.current);
    window.addEventListener("devicemotion", handleMotionRef.current);
  };

  /* -------------------- throw -------------------- */
  const throwDart = () => {
    if (!readyRef.current) return;
    readyRef.current = false;

    const power = Math.max(0, Math.min(1, accPeakRef.current / 25));

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
    const ok = await requestMotionPermission();
    if (!ok) return;
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
