"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";

type Props = {
  /** 타겟이 들어갈 기준면(보통 z=0)에 맞출지 */
  targetZ?: number;
  /** 전체 스케일 */
  scale?: number;
};

export default function MachineProcedural({ targetZ = 0, scale = 1 }: Props) {
  // ====== 치수(너희 타겟 그리드에 맞춰 조절) ======
  // 2번 이미지처럼 세로형 케이스 느낌
  const dims = useMemo(() => {
    const W = 22; // 가로
    const H = 40; // 세로
    const D = 12; // 깊이(두께)
    const frame = 1.2; // 프레임 두께
    return { W, H, D, frame };
  }, []);

  const { W, H, D, frame } = dims;

  // 타겟은 보통 z=0 근처에 있음.
  // 케이스는 "타겟보다 살짝 뒤"에 있고 유리는 "타겟보다 살짝 앞"에 오게 구성
  const machineCenterZ = targetZ - 8;

  // ====== 소재(가벼운 MeshStandardMaterial 위주) ======
  const materials = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0c0f16"),
      metalness: 0.25,
      roughness: 0.55,
    });

    const inner = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#05070c"),
      metalness: 0.0,
      roughness: 0.95,
    });

    const led = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0a0a0a"),
      metalness: 0.0,
      roughness: 0.25,
      emissive: new THREE.Color("#d9f2ff"),
      emissiveIntensity: 3.0,
    });

    const glass = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#bfe9ff"),
      metalness: 0.0,
      roughness: 0.05,
      transmission: 1.0, // 유리
      thickness: 0.4,
      transparent: true,
      opacity: 0.18,
      ior: 1.4,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });

    const basePanel = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0a0d13"),
      metalness: 0.15,
      roughness: 0.65,
    });

    const button = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#6d42ff"),
      metalness: 0.1,
      roughness: 0.35,
      emissive: new THREE.Color("#6d42ff"),
      emissiveIntensity: 0.7,
    });

    return { body, inner, led, glass, basePanel, button };
  }, []);

  // ====== 헬퍼: 프레임/내부 크기 ======
  const innerW = W - frame * 2;
  const innerH = H - frame * 2;

  // 유리 위치(타겟보다 살짝 앞)
  const glassZ = targetZ + 0.2;

  // 안쪽 백패널(깊이감용)
  const backZ = machineCenterZ - D * 0.35;

  // LED 스트립 위치(앞쪽 프레임 근처)
  const ledZ = machineCenterZ + D * 0.45;

  // ====== 격자 설정 (8줄 x 6열) ======
  const rows = 8;
  const cols = 6;
  const gridMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#4a4845"),
        metalness: 0.6,
        roughness: 0.4,
      }),
    []
  );

  // 격자 간격 (타겟 간격과 동일하게)
  const cellWidth = innerW / cols;
  const cellHeight = innerH / rows;
  const gridThickness = 0.15;
  const gridDepth = 0.3;

  return (
    <group scale={scale} position={[0, 0, 0]}>
      {/* 조명(머신 전용, 과하면 팬 돎 → 최소로) */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[20, 30, 25]} intensity={0.9} />

      {/* ====== 외곽 프레임(라운드 박스) ====== */}
      <group position={[0, 0, machineCenterZ]}>
        {/* 바깥 몸체(전체 윤곽) */}
        <RoundedBox
          args={[W, H, D]}
          radius={1.4}
          smoothness={6}
          material={materials.body}
        />

        {/* 안쪽 캐비티(프레임 안쪽을 어둡게) */}
        <mesh material={materials.inner}>
          <boxGeometry args={[innerW, innerH, D * 0.85]} />
          <mesh position={[0, 0, -0.2]} />
        </mesh>

        {/* 안쪽 백패널 */}
        <mesh
          position={[0, 0, backZ - machineCenterZ]}
          material={materials.inner}
        >
          <planeGeometry args={[innerW * 0.95, innerH * 0.95]} />
          {/* plane 기본은 XY, z는 position으로 */}
        </mesh>

        {/* LED 좌/우 스트립 */}
        <mesh
          position={[-(W / 2 - frame * 0.55), 0, ledZ - machineCenterZ]}
          material={materials.led}
        >
          <boxGeometry args={[0.35, innerH * 0.92, 0.35]} />
        </mesh>
        <mesh
          position={[W / 2 - frame * 0.55, 0, ledZ - machineCenterZ]}
          material={materials.led}
        >
          <boxGeometry args={[0.35, innerH * 0.92, 0.35]} />
        </mesh>

        {/* 상단/하단 LED 라인(있으면 더 “오락기” 느낌) */}
        <mesh
          position={[0, innerH / 2 - 0.3, ledZ - machineCenterZ]}
          material={materials.led}
        >
          <boxGeometry args={[innerW * 0.92, 0.25, 0.25]} />
        </mesh>
        <mesh
          position={[0, -(innerH / 2 - 0.3), ledZ - machineCenterZ]}
          material={materials.led}
        >
          <boxGeometry args={[innerW * 0.92, 0.25, 0.25]} />
        </mesh>
      </group>

      {/* ====== 유리(타겟보다 앞) ====== */}
      <mesh position={[0, 0, glassZ]} material={materials.glass}>
        <planeGeometry args={[innerW * 1.02, innerH * 1.02]} />
      </mesh>

      {/* ====== 격자선 (8x6 그리드) ====== */}
      <group position={[0, 0, glassZ - 0.3]}>
        {/* 세로 격자선 (가로로 나누는 선들) */}
        {Array.from({ length: cols - 1 }).map((_, i) => {
          const x = -innerW / 2 + cellWidth * (i + 1);
          return (
            <mesh key={`v-${i}`} position={[x, 0, 0]} material={gridMaterial}>
              <boxGeometry args={[gridThickness, innerH * 1.05, gridDepth]} />
            </mesh>
          );
        })}

        {/* 가로 격자선 (세로로 나누는 선들) */}
        {Array.from({ length: rows - 1 }).map((_, i) => {
          const y = innerH / 2 - cellHeight * (i + 1);
          return (
            <mesh key={`h-${i}`} position={[0, y, 0]} material={gridMaterial}>
              <boxGeometry args={[innerW * 1.05, gridThickness, gridDepth]} />
            </mesh>
          );
        })}
      </group>

      {/* ====== 하단 베이스(점수/버튼 들어갈 영역 느낌) ====== */}
      <group position={[0, -(H / 2 + 6), machineCenterZ + 1.0]}>
        <RoundedBox
          args={[W * 0.92, 10, 6]}
          radius={1.2}
          smoothness={6}
          material={materials.basePanel}
        />

        {/* 중앙 START 버튼 */}
        <mesh position={[0, 0.3, 3.2]} material={materials.button}>
          <cylinderGeometry args={[1.8, 1.8, 0.8, 32]} />
        </mesh>

        {/* 좌우 패널(플레이어 영역 느낌) */}
        <RoundedBox
          args={[W * 0.32, 3.2, 1.2]}
          radius={0.7}
          smoothness={6}
          position={[-W * 0.25, -2.0, 3.0]}
          material={materials.body}
        />
        <RoundedBox
          args={[W * 0.32, 3.2, 1.2]}
          radius={0.7}
          smoothness={6}
          position={[W * 0.25, -2.0, 3.0]}
          material={materials.body}
        />
      </group>
    </group>
  );
}
