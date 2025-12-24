import { OrbitControls } from "@react-three/drei";
import { useEffect, useState } from "react";
import MachineProcedural from "./MachineProcedural";
import Target from "./Target";
import HitEffect from "./HitEffect";

interface HitEffectData {
  id: string;
  position: [number, number, number];
}

export default function Scene() {
  // 8줄 x 6열 그리드 생성
  const rows = 8;
  const cols = 6;
  const models = [
    "/test/model_1.glb",
    "/test/model_2.glb",
    "/test/model_3.glb",
  ];

  // 맞은 타겟 추적 (row-col 형식)
  const [hitTargets, setHitTargets] = useState<Set<string>>(new Set());
  // 활성 히트 이펙트 추적
  const [hitEffects, setHitEffects] = useState<HitEffectData[]>([]);

  // MachineProcedural과 동일한 치수 사용
  const machineW = 22;
  const machineH = 40;
  const frame = 1.2;
  const innerW = machineW - frame * 2;
  const innerH = machineH - frame * 2;

  // 격자 칸 크기
  const cellWidth = innerW / cols;
  const cellHeight = innerH / rows;

  // 그리드 시작점 (왼쪽 상단)
  const gridStartX = -innerW / 2;
  const gridStartY = innerH / 2;

  // DART_THROW 이벤트 리스너 - 히트 감지
  useEffect(() => {
    const handleThrow = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;

      // aim 좌표가 있는지 확인
      if (!data.aim) return;

      const { x, y } = data.aim; // -1..1 범위

      // aim 좌표를 그리드 인덱스로 변환
      // x: -1(왼쪽) ~ 1(오른쪽) → 0 ~ cols-1
      // y: -1(위) ~ 1(아래) → 0 ~ rows-1
      const colIndex = Math.floor(((x + 1) / 2) * cols);
      const rowIndex = Math.floor(((y + 1) / 2) * rows);

      // 범위 체크
      if (
        rowIndex < 0 ||
        rowIndex >= rows ||
        colIndex < 0 ||
        colIndex >= cols
      ) {
        console.log("❌ 타겟 범위 밖:", { rowIndex, colIndex, x, y });
        return;
      }

      const targetId = `${rowIndex}-${colIndex}`;

      // 이미 맞은 타겟인지 확인
      if (hitTargets.has(targetId)) {
        console.log("⚠️ 이미 맞은 타겟:", targetId);
        return;
      }

      console.log("🎯 히트!", { targetId, rowIndex, colIndex, x, y });

      // 히트한 타겟의 실제 위치 계산
      const cellCenterX = gridStartX + cellWidth * (colIndex + 0.5);
      const cellBottomY = gridStartY - cellHeight * (rowIndex + 1);
      const targetY = cellBottomY + 0.8;
      const targetPosition: [number, number, number] = [
        cellCenterX,
        targetY,
        0,
      ];

      // 히트 타겟 추가
      setHitTargets((prev) => new Set(prev).add(targetId));

      // 히트 이펙트 추가
      setHitEffects((prev) => [
        ...prev,
        {
          id: `${targetId}-${Date.now()}`,
          position: targetPosition,
        },
      ]);
    };

    window.addEventListener("DART_THROW", handleThrow);
    return () => window.removeEventListener("DART_THROW", handleThrow);
  }, [hitTargets, gridStartX, gridStartY, cellWidth, cellHeight, cols, rows]);

  // 히트 이펙트 완료 핸들러
  const handleEffectComplete = (effectId: string) => {
    setHitEffects((prev) => prev.filter((effect) => effect.id !== effectId));
  };

  return (
    <>
      {/* 기본 조명 - 전체 밝기 */}
      <ambientLight intensity={1.5} />

      {/* 왼쪽 directionalLight */}
      <directionalLight
        position={[-20, 0, 20]}
        intensity={1.5}
        color="#ffffff"
      />

      {/* 오른쪽 directionalLight */}
      <directionalLight
        position={[20, 0, 20]}
        intensity={1.5}
        color="#ffffff"
      />

      {/* 상단 전체 조명 */}
      <directionalLight position={[0, 20, 15]} intensity={0.5} />

      {/* 머신(배경) */}
      <MachineProcedural targetZ={0} scale={1} />

      {/* 8줄 x 6열 = 48개 모델 렌더링 (히트되지 않은 것만) */}
      {Array.from({ length: rows }).map((_, rowIndex) =>
        Array.from({ length: cols }).map((_, colIndex) => {
          const targetId = `${rowIndex}-${colIndex}`;

          // 이미 맞은 타겟은 렌더링하지 않음
          if (hitTargets.has(targetId)) {
            return null;
          }

          // 각 칸의 중심 위치
          const cellCenterX = gridStartX + cellWidth * (colIndex + 0.5);

          // 각 칸의 바닥 위치 (중력 느낌)
          const cellBottomY = gridStartY - cellHeight * (rowIndex + 1);
          // 모델 높이의 절반만큼 위로 올려서 바닥에 닿게 함
          const y = cellBottomY + 0.8; // 0.8은 모델 높이의 절반 (조정 가능)

          const modelIndex = (rowIndex * cols + colIndex) % models.length;

          return (
            <Target
              key={targetId}
              modelPath={models[modelIndex]}
              position={[cellCenterX, y, 0]}
            />
          );
        })
      )}

      {/* 히트 이펙트 렌더링 */}
      {hitEffects.map((effect) => (
        <HitEffect
          key={effect.id}
          position={effect.position}
          onComplete={() => handleEffectComplete(effect.id)}
        />
      ))}

      {/* 개발용 – 현장 배포 전 제거 */}
      <OrbitControls enableZoom={false} />
    </>
  );
}
