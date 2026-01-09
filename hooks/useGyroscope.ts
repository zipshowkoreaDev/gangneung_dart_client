import { useState, useRef, useCallback } from "react";

const ARMING_MS = 600;
const MAG_THRESH = 18;
const JERK_THRESH = 8;
const THROW_COOLDOWN_MS = 700;
const AIM_HZ = 30;
const AIM_INTERVAL = 1000 / AIM_HZ;
const BASELINE_SAMPLES = 12;

interface UseGyroscopeProps {
  selectedMode: "solo" | "duo" | null;
  currentTurn: string | null;
  customName: string;
  emitAimUpdate: (aim: { x: number; y: number }, skin?: string) => void;
  emitAimOff: () => void;
  emitThrowDart: (payload: { aim: { x: number; y: number }; score: number }) => void;
}

export function useGyroscope({
  selectedMode,
  currentTurn,
  customName,
  emitAimUpdate,
  emitAimOff,
  emitThrowDart,
}: UseGyroscopeProps) {
  const [aimPosition, setAimPosition] = useState({ x: 0, y: 0 });
  const [sensorsReady, setSensorsReady] = useState(false);
  const [sensorError, setSensorError] = useState("");
  const [throwsLeft, setThrowsLeft] = useState(3);
  const [hasFinishedTurn, setHasFinishedTurn] = useState(false);

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

    emitAimOff();
  }, [emitAimOff]);

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
      if (
        selectedMode === "duo" &&
        currentTurn &&
        currentTurn !== customName
      ) {
        return;
      }

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
        emitAimUpdate({ x, y });
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

        emitThrowDart({
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
  }, [stopSensors, selectedMode, currentTurn, customName, emitAimUpdate, emitThrowDart]);

  return {
    aimPosition,
    sensorsReady,
    sensorError,
    throwsLeft,
    hasFinishedTurn,
    startSensors,
    stopSensors,
    requestMotionPermission,
    setHasFinishedTurn,
  };
}
