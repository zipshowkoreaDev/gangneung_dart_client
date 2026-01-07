"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useMobileSocket } from "@/hooks/useMobileSocket";

const ARMING_MS = 600;
const MAG_THRESH = 18;
const JERK_THRESH = 8;
const THROW_COOLDOWN_MS = 700;
const AIM_HZ = 30;
const AIM_INTERVAL = 1000 / AIM_HZ;
const BASELINE_SAMPLES = 12;

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
  const [selectedMode, setSelectedMode] = useState<"solo" | "duo" | null>(null);
  const [nameError, setNameError] = useState("");
  const [isInGame, setIsInGame] = useState(false);
  const [isWaitingForDuo, setIsWaitingForDuo] = useState(false);
  const [aimPosition, setAimPosition] = useState({ x: 0, y: 0 });
  const [sensorsReady, setSensorsReady] = useState(false);
  const [sensorError, setSensorError] = useState("");
  const [otherPlayerActive, setOtherPlayerActive] = useState(false);
  const [throwsLeft, setThrowsLeft] = useState(3);
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [hasFinishedTurn, setHasFinishedTurn] = useState(false);

  const emitRef = useRef<{
    aimUpdate: (aim: { x: number; y: number }, skin?: string) => void;
    aimOff: () => void;
    throwDart: (payload: {
      aim: { x: number; y: number };
      score: number;
    }) => void;
    selectMode: (mode: "solo" | "duo") => void;
  }>({
    aimUpdate: () => {},
    aimOff: () => {},
    throwDart: () => {},
    selectMode: () => {},
  });

  // 이름이 있으면 바로 소켓 연결
  const shouldConnect = customName.length > 0;

  // 콜백 함수들을 useCallback으로 안정화
  const handlePlayerCountChange = useCallback((count: number) => {
    setPlayerCount(count);
  }, []);

  const handleOtherPlayerActive = useCallback((active: boolean) => {
    setOtherPlayerActive(active);
  }, []);

  const handleTurnUpdate = useCallback((turn: string | null) => {
    setCurrentTurn(turn);
  }, []);

  const { emitAimUpdate, emitAimOff, emitThrowDart, emitSelectMode } = useMobileSocket({
    room: shouldConnect ? room : "",
    customName,
    onPlayerCountChange: handlePlayerCountChange,
    onOtherPlayerActive: handleOtherPlayerActive,
    onTurnUpdate: handleTurnUpdate,
  });

  useEffect(() => {
    emitRef.current = {
      aimUpdate: emitAimUpdate,
      aimOff: emitAimOff,
      throwDart: emitThrowDart,
      selectMode: emitSelectMode,
    };
  }, [emitAimUpdate, emitAimOff, emitThrowDart, emitSelectMode]);

  const sensorsActiveRef = useRef(false);
  const lastAimSentRef = useRef(0);
  const gravityZRef = useRef(0);
  const aimRef = useRef(aimPosition);
  const readyRef = useRef(true);
  const aimReadyRef = useRef(false);
  const throwCountRef = useRef(0);
  const baseGammaSumRef = useRef(0);
  const baseBetaSumRef = useRef(0);
  const baseSamplesRef = useRef(0);
  const baseGammaRef = useRef(0);
  const baseBetaRef = useRef(0);
  const armedAtRef = useRef(0);
  const baselineSumRef = useRef(0);
  const baselineSamplesRef = useRef(0);
  const prevMagRef = useRef(0);
  const throwBlockedUntilRef = useRef(0);
  const handleOrientationRef = useRef<
    ((e: DeviceOrientationEvent) => void) | null
  >(null);
  const handleMotionRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  const norm = (v: number, a: number, b: number) =>
    Math.max(-1, Math.min(1, ((v - a) / (b - a)) * 2 - 1));

  const requestMotionPermission = async (): Promise<boolean> => {
    try {
      if (
        typeof DeviceMotionEvent !== "undefined" &&
        "requestPermission" in DeviceMotionEvent
      ) {
        const result = await (
          DeviceMotionEvent as unknown as {
            requestPermission(): Promise<string>;
          }
        ).requestPermission();
        if (result !== "granted") {
          setSensorError("모션 권한이 필요합니다.");
          return false;
        }
      }

      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        "requestPermission" in DeviceOrientationEvent
      ) {
        const result = await (
          DeviceOrientationEvent as unknown as {
            requestPermission(): Promise<string>;
          }
        ).requestPermission();
        if (result !== "granted") {
          setSensorError("방향 권한이 필요합니다.");
          return false;
        }
      }

      setSensorError("");
      return true;
    } catch {
      setSensorError("센서 권한 요청에 실패했습니다.");
      return false;
    }
  };

  const stopSensors = useCallback(() => {
    if (!sensorsActiveRef.current) return;

    sensorsActiveRef.current = false;
    setSensorsReady(false);
    setThrowsLeft(0);
    readyRef.current = true;
    throwCountRef.current = 0;
    baseGammaSumRef.current = 0;
    baseBetaSumRef.current = 0;
    baseSamplesRef.current = 0;

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

    emitRef.current.aimOff();
  }, []);

  const startSensors = useCallback(() => {
    if (sensorsActiveRef.current) return;

    sensorsActiveRef.current = true;
    setSensorsReady(true);
    setHasFinishedTurn(false);
    setThrowsLeft(3);
    readyRef.current = true;
    aimReadyRef.current = false;
    throwCountRef.current = 0;
    baseGammaSumRef.current = 0;
    baseBetaSumRef.current = 0;
    baseSamplesRef.current = 0;
    baseGammaRef.current = 0;
    baseBetaRef.current = 0;
    armedAtRef.current = performance.now();
    baselineSumRef.current = 0;
    baselineSamplesRef.current = 0;
    prevMagRef.current = 0;
    throwBlockedUntilRef.current = 0;

    const isIOS =
      typeof navigator !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent);
    const gammaRange = isIOS ? 20 : 35;
    const betaRange = isIOS ? 20 : 35;

    handleOrientationRef.current = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;

      if (baseSamplesRef.current < BASELINE_SAMPLES) {
        baseGammaSumRef.current += gamma;
        baseBetaSumRef.current += beta;
        baseSamplesRef.current += 1;
        if (baseSamplesRef.current === BASELINE_SAMPLES) {
          baseGammaRef.current = baseGammaSumRef.current / BASELINE_SAMPLES;
          baseBetaRef.current = baseBetaSumRef.current / BASELINE_SAMPLES;
        }
      }

      const g = gamma - baseGammaRef.current;
      const b = beta - baseBetaRef.current;

      const x = norm(g, -gammaRange, gammaRange);
      const y0 = isIOS
        ? norm(b, -betaRange, betaRange)
        : -norm(b, -betaRange, betaRange);
      const faceUp =
        Math.abs(gravityZRef.current) > 4 && gravityZRef.current < 0;
      const y = faceUp ? -y0 : y0;

      aimRef.current = { x, y };
      setAimPosition({ x, y });
      aimReadyRef.current = true;

      const now = performance.now();
      if (now - lastAimSentRef.current > AIM_INTERVAL) {
        lastAimSentRef.current = now;
        emitRef.current.aimUpdate({ x, y });
      }
    };

    handleMotionRef.current = (e: DeviceMotionEvent) => {
      const ag = e.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
      gravityZRef.current = ag.z || 0;

      const now = performance.now();
      if (now < throwBlockedUntilRef.current) {
        return;
      }

      const a = e.acceleration || ag;
      const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);

      if (now - armedAtRef.current < ARMING_MS) {
        baselineSumRef.current += mag;
        baselineSamplesRef.current += 1;
        prevMagRef.current = mag;
        return;
      }

      const baseline = baselineSamplesRef.current
        ? baselineSumRef.current / baselineSamplesRef.current
        : 0;
      const magAdj = Math.max(0, mag - baseline);
      const jerk = mag - prevMagRef.current;
      prevMagRef.current = mag;

      if (
        readyRef.current &&
        aimReadyRef.current &&
        magAdj > MAG_THRESH &&
        jerk > JERK_THRESH
      ) {
        if (
          selectedMode === "duo" &&
          currentTurn &&
          currentTurn !== customName
        ) {
          return;
        }

        readyRef.current = false;
        throwBlockedUntilRef.current = now + THROW_COOLDOWN_MS;

        emitRef.current.throwDart({
          aim: aimRef.current,
          score: 0,
        });
        throwCountRef.current += 1;
        setThrowsLeft((prev) => Math.max(0, prev - 1));
        if (throwCountRef.current >= 3) {
          setHasFinishedTurn(true);
          stopSensors();
          return;
        }

        setTimeout(() => {
          if (!sensorsActiveRef.current) return;
          readyRef.current = true;
          armedAtRef.current = performance.now();
          baselineSumRef.current = 0;
          baselineSamplesRef.current = 0;
          prevMagRef.current = 0;
        }, 300);
      }
    };

    window.addEventListener("deviceorientation", handleOrientationRef.current);
    window.addEventListener("devicemotion", handleMotionRef.current);
  }, [stopSensors, selectedMode, currentTurn, customName]);

  useEffect(() => {
    if (selectedMode !== "duo") return;
    if (!isWaitingForDuo) return;
    if (playerCount < 2) return;

    // 비동기로 상태 업데이트하여 cascading render 방지
    const timer = setTimeout(() => {
      setIsWaitingForDuo(false);
      setIsInGame(true);
      startSensors();
      emitRef.current.aimUpdate({ x: 0, y: 0 });
    }, 0);

    return () => clearTimeout(timer);
  }, [playerCount, selectedMode, isWaitingForDuo, startSensors]);

  useEffect(() => {
    if (!customName || !currentTurn) return;
    if (currentTurn === customName) {
      // 비동기로 상태 업데이트하여 cascading render 방지
      const timer = setTimeout(() => {
        setHasFinishedTurn(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentTurn, customName]);

  useEffect(() => {
    return () => stopSensors();
  }, [stopSensors]);

  const handleModeSelect = async (mode: "solo" | "duo") => {
    if (!customName) {
      setNameError("이름을 입력하면 시작할 수 있어요");
      return;
    }

    if (mode === "solo" && playerCount > 1) {
      setNameError("다른 플레이어가 있어 혼자하기를 할 수 없습니다");
      return;
    }

    const hasPermission = await requestMotionPermission();
    if (!hasPermission) {
      return;
    }

    setNameError("");
    setSelectedMode(mode);
    setHasFinishedTurn(false);

    // 모드 선택을 Display에 알림
    emitSelectMode(mode);

    if (mode === "duo" && playerCount < 2) {
      setIsWaitingForDuo(true);
      setIsInGame(false);
      emitAimUpdate({ x: 0, y: 0 });
      return;
    }

    setIsWaitingForDuo(false);
    setIsInGame(true);
    startSensors();
    emitAimUpdate({ x: 0, y: 0 });
  };

  const otherPlayersCount = customName
    ? Math.max(0, playerCount - 1)
    : playerCount;
  const isSoloRunning = otherPlayerActive && otherPlayersCount === 1;
  const isSoloDisabled = !customName || playerCount > 1 || isSoloRunning;
  const isDuoDisabled = !customName || isSoloRunning;
  const isMyTurn = currentTurn ? currentTurn === customName : true;
  const turnMessage = isSoloRunning
    ? "혼자하기가 진행 중입니다."
    : selectedMode === "duo"
    ? hasFinishedTurn
      ? "결과를 기다려 주세요"
      : isMyTurn
      ? "내 차례입니다"
      : "아직 차례가 아닙니다"
    : "";

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
      {isInGame ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              color: "white",
              fontSize: "18px",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            <div>{customName}</div>
            <div style={{ fontSize: "14px", opacity: 0.7, marginTop: "4px" }}>
              {selectedMode === "solo" ? "혼자하기" : "둘이서 하기"} 모드
            </div>
            {turnMessage && (
              <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "6px" }}>
                {turnMessage}
              </div>
            )}
          </div>

          {/* 자이로 조준 패드 */}
          <div
            style={{
              width: "90%",
              maxWidth: "500px",
              height: "60vh",
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: "24px",
              border: "3px solid rgba(255, 255, 255, 0.3)",
              position: "relative",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(calc(-50% + ${
                  aimPosition.x * 45
                }%), calc(-50% + ${aimPosition.y * 45}%))`,
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                border: "4px solid #FFD700",
                background: "rgba(255, 215, 0, 0.3)",
                pointerEvents: "none",
                transition: "transform 0.05s ease-out",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "white",
                fontSize: "14px",
                opacity: 0.5,
                pointerEvents: "none",
              }}
            >
              휴대폰을 기울여 조준하세요
            </div>
          </div>

          <div
            style={{
              marginTop: "20px",
              color: "white",
              fontSize: "12px",
              opacity: 0.6,
            }}
          >
            X: {aimPosition.x.toFixed(2)}, Y: {aimPosition.y.toFixed(2)}
          </div>
          <div
            style={{
              marginTop: "8px",
              color: "white",
              fontSize: "14px",
              opacity: 0.8,
              letterSpacing: "6px",
            }}
          >
            {Array.from({ length: 3 }).map((_, index) => (
              <span
                key={index}
                style={{ opacity: index < throwsLeft ? 1 : 0.2 }}
              >
                O
              </span>
            ))}
          </div>

          {!sensorsReady && (
            <button
              onClick={async () => {
                const ok = await requestMotionPermission();
                if (ok) {
                  startSensors();
                }
              }}
              style={{
                marginTop: "12px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: 600,
                borderRadius: "999px",
                border: "none",
                background: "rgba(255, 255, 255, 0.2)",
                color: "white",
                cursor: "pointer",
              }}
            >
              자이로 권한 다시 요청
            </button>
          )}

          {sensorError && (
            <div
              style={{
                marginTop: "10px",
                color: "#ffdddd",
                fontSize: "12px",
                opacity: 0.8,
              }}
            >
              {sensorError}
            </div>
          )}
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
          {isWaitingForDuo && (
            <div
              style={{ fontSize: "14px", opacity: 0.8, marginBottom: "8px" }}
            >
              플레이어 2를 기다리는 중...
            </div>
          )}
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
              disabled={isSoloRunning}
              style={{
                padding: "16px",
                fontSize: "18px",
                fontWeight: "600",
                borderRadius: "12px",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                background: isSoloRunning
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(255, 255, 255, 0.1)",
                color: "white",
                textAlign: "center",
                outline: "none",
                backdropFilter: "blur(10px)",
                opacity: isSoloRunning ? 0.6 : 1,
              }}
            />

            {playerCount > 0 && (
              <div
                style={{
                  fontSize: "14px",
                  color: "white",
                  opacity: 0.7,
                  textAlign: "center",
                }}
              >
                현재 방 인원: {playerCount}명
                {playerCount > 1 && " (혼자하기 불가)"}
              </div>
            )}
            {isSoloRunning && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#ffdddd",
                  textAlign: "center",
                  opacity: 0.8,
                }}
              >
                혼자하기가 진행 중입니다.
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
              disabled={isSoloDisabled}
              style={{
                padding: "20px 40px",
                fontSize: "24px",
                fontWeight: "bold",
                borderRadius: "16px",
                border: "none",
                background: isSoloDisabled
                  ? "#888"
                  : "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                color: isSoloDisabled ? "#ccc" : "#000",
                cursor: isSoloDisabled ? "not-allowed" : "pointer",
                boxShadow: isSoloDisabled
                  ? "none"
                  : "0 8px 32px rgba(255, 215, 0, 0.4)",
                opacity: isSoloDisabled ? 0.5 : 1,
                transition: "all 0.3s ease",
              }}
            >
              혼자
              {playerCount > 1 && (
                <div style={{ fontSize: "12px", marginTop: "4px" }}>
                  (다른 플레이어 있음)
                </div>
              )}
            </button>

            <button
              onClick={() => handleModeSelect("duo")}
              disabled={isDuoDisabled}
              style={{
                padding: "20px 40px",
                fontSize: "24px",
                fontWeight: "bold",
                borderRadius: "16px",
                border: "none",
                background: isDuoDisabled
                  ? "#888"
                  : "linear-gradient(135deg, #4CAF50 0%, #45a049 100%)",
                color: "white",
                cursor: isDuoDisabled ? "not-allowed" : "pointer",
                boxShadow: !customName
                  ? "none"
                  : "0 8px 32px rgba(76, 175, 80, 0.4)",
                opacity: isDuoDisabled ? 0.5 : 1,
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
