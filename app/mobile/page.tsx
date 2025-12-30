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
  const [isThrowing, setIsThrowing] = useState(false); // 다트 던지는 중
  const [isRoomFull, setIsRoomFull] = useState(false);

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

  /* -------------------- debug log -------------------- */
  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${msg}`);
  }, []);

  /* -------------------- init -------------------- */
  useEffect(() => {
    // room은 항상 "zipshow"로 고정
    const r = "zipshow";
    setRoom(r);
    addLog(`Room: ${r}`);
  }, [addLog]);

  /* -------------------- socket -------------------- */
  useEffect(() => {
    if (!room) return;

    addLog(`소켓 연결 시도 중...`);
    socket.connect();

    socket.on("connect", () => {
      addLog(`✅ 소켓 연결 성공: ${socket.id}`);

      // joinRoom 요청 (사용자 입력 이름 사용)
      socket.emit("joinRoom", {
        room,
        name: customName,
      });
      addLog(`🚪 Room 참가 요청: ${room}, 이름: ${customName}`);
    });

    socket.on("connect_error", (err) => {
      addLog(`❌ 연결 에러: ${err.message}`);
      console.error("❌ socket error:", err);
    });

    socket.on("disconnect", (reason) => {
      addLog(`⚠️ 연결 끊김: ${reason}`);
    });

    // 문서 스펙: clientInfo 수신
    socket.on(
      "clientInfo",
      (data: { socketId: string; name: string; room: string }) => {
        addLog(`📋 클라이언트 정보: ${data.socketId}`);
      }
    );

    // 문서 스펙: joinedRoom 수신
    socket.on("joinedRoom", (data: { room: string; playerCount: number }) => {
      addLog(`✅ 방 참가 완료: ${data.room}, 플레이어 수: ${data.playerCount}`);

      // 최대 2명까지만 허용 (Display 제외)
      // playerCount > 3 = Display(1) + 3명 이상 = 방이 가득 함
      if (data.playerCount > 3) {
        setIsRoomFull(true);
        addLog(`⚠️ 방이 가득 참: ${data.playerCount}명 (최대 3명)`);
        socket.disconnect();
      }
    });

    // 문서 스펙: roomPlayerCount 수신
    socket.on(
      "roomPlayerCount",
      (data: { room: string; playerCount: number }) => {
        addLog(`👥 플레이어 수 변경: ${data.playerCount}명`);

        // 플레이어 수가 증가하여 방이 가득 찰 경우
        if (data.playerCount > 3 && !isRoomFull) {
          setIsRoomFull(true);
          addLog(`⚠️ 방이 가득 참: ${data.playerCount}명 (최대 3명)`);
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

      // 개발 모드에서는 HMR로 인한 재연결 방지
      if (process.env.NODE_ENV === "production") {
        socket.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, customName, addLog]);

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

    if (socket.connected && customName) {
      socket.emit("aim-off", {
        room,
        name: customName,
      });
    }
  }, [room, customName]);

  /* -------------------- start sensors -------------------- */
  const startSensors = () => {
    if (sensorsActiveRef.current) return;

    addLog("🎮 센서 시작");
    sensorsActiveRef.current = true;
    readyRef.current = true;
    setIsReady(true);

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
      const y = faceUp ? -y0 : y0; // Y축 반전

      const aimValue = { x, y };
      aimRef.current = aimValue;
      aimReadyRef.current = true;

      orientationCount++;
      if (orientationCount === 1) {
        addLog(
          `📱 자이로 이벤트 발생! gamma=${g.toFixed(1)}, beta=${b.toFixed(1)}`
        );
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
        if (now - armedAtRef.current < 2000) {
          addLog(`📡 aim-update 전송 (room=${room}, player=${customName})`);
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

    setTimeout(() => {
      if (orientationCount === 0) {
        addLog("⚠️ 자이로 이벤트가 발생하지 않음! 권한을 확인하세요.");
      }
    }, 2000);
  };

  /* -------------------- throw -------------------- */
  const throwDart = () => {
    if (!readyRef.current) return;
    if (!socket.connected) {
      addLog("⚠️ 소켓 연결 끊김 - 던지기 실패");
      return;
    }
    if (!customName) {
      addLog("⚠️ 플레이어 이름 미입력 - 던지기 실패");
      return;
    }

    readyRef.current = false;

    // 다트 던지기 애니메이션 시작
    setIsThrowing(true);
    setTimeout(() => setIsThrowing(false), 1000); // 1초 후 리셋

    const power = Math.max(0, Math.min(1, accPeakRef.current / 25));
    // 던지는 순간의 정확한 aim 좌표 사용
    const currentAim = aimRef.current;

    addLog(
      `🎯 다트 던짐! power=${power.toFixed(2)} aim=(${currentAim.x.toFixed(
        2
      )}, ${currentAim.y.toFixed(2)})`
    );
    // 문서 스펙: throw-dart 이벤트 (score는 임시로 0 또는 계산된 값)
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
                  방이 가득 찼습니다
                </div>
                <div
                  style={{ fontSize: "14px", opacity: 0.7, lineHeight: 1.5 }}
                >
                  최대 2명까지만 참가할 수 있습니다.
                  <br />
                  다른 플레이어가 나갈 때까지 기다려주세요.
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
            cursor: !isReady && (isRoomFull || !customName) ? "not-allowed" : "pointer",
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
