"use client";

import { useRef, useState, useEffect } from "react";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface StuckDartProps {
  position: [number, number, number];
}

function StuckDart({ position }: StuckDartProps) {
  const { scene } = useGLTF("/models/dart.glb");

  return (
    <group position={position}>
      <primitive
        object={scene.clone()}
        rotation={[0, 0, -Math.PI / 2]}
        scale={0.4}
      />
    </group>
  );
}

interface FlyingDartProps {
  targetPosition: [number, number, number];
  onComplete: () => void;
}

function FlyingDart({ targetPosition, onComplete }: FlyingDartProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/dart.glb");
  const [progress, setProgress] = useState(0);

  // 시작 위치 (화면 앞쪽, 아래쪽)
  const startPosition: [number, number, number] = [
    targetPosition[0],
    targetPosition[1],
    30, // 카메라 앞쪽에서 시작
  ];

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // 진행도 업데이트 (1초 동안 날아감)
    setProgress((prev) => {
      const next = prev + delta * 1.5; // 속도 조절
      if (next >= 1) {
        onComplete();
        return 1;
      }
      return next;
    });

    // lerp로 위치 보간
    groupRef.current.position.x = THREE.MathUtils.lerp(
      startPosition[0],
      targetPosition[0],
      progress
    );
    groupRef.current.position.y = THREE.MathUtils.lerp(
      startPosition[1],
      targetPosition[1],
      progress
    );
    groupRef.current.position.z = THREE.MathUtils.lerp(
      startPosition[2],
      targetPosition[2],
      progress
    );

    // 날아가는 동안 빠르게 회전
    groupRef.current.rotation.y += delta * 3;
  });

  return (
    <group ref={groupRef}>
      <primitive
        object={scene.clone()}
        rotation={[0, 0, -Math.PI / 2]}
        scale={0.4}
      />
    </group>
  );
}

interface ThrownDart {
  id: string;
  position: [number, number, number];
}

interface FlyingDartData {
  id: string;
  position: [number, number, number];
}

function RotatingRoulette({
  flyingDarts,
  stuckDarts,
}: {
  flyingDarts: FlyingDartData[];
  stuckDarts: ThrownDart[];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/roulette.glb");

  // 시계 방향으로 천천히 회전
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Z축 기준 회전
    groupRef.current.rotation.z -= delta * 0.3; // 0.3은 회전 속도 (조절 가능)
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} rotation={[0, -Math.PI / 2, 0]} scale={1.25} />

      {/* 날아가는 다트들 */}
      {flyingDarts.map((dart) => (
        <FlyingDart
          key={dart.id}
          targetPosition={dart.position}
          onComplete={() => {}}
        />
      ))}

      {/* 꽂힌 다트들 */}
      {stuckDarts.map((dart) => (
        <StuckDart key={dart.id} position={dart.position} />
      ))}
    </group>
  );
}

function DartEventHandler({
  onDartThrow,
}: {
  onDartThrow: (position: [number, number, number]) => void;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const handleThrow = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;

      if (!data.aim) return;

      const { x, y } = data.aim; // -1..1 범위 (NDC)

      // Raycaster로 화면 좌표를 3D 좌표로 변환
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2(x, y);

      // 카메라에서 마우스 위치로 ray 설정
      raycaster.setFromCamera(mouse, camera);

      // 룰렛 평면 (z = 1)과 교차점 계산
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1); // z = 1 평면
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersectPoint);

      console.log("🎯 Aim:", { x, y }, "→ 3D:", intersectPoint);

      onDartThrow([intersectPoint.x, intersectPoint.y, intersectPoint.z]);
    };

    window.addEventListener("DART_THROW", handleThrow);
    return () => window.removeEventListener("DART_THROW", handleThrow);
  }, [camera, onDartThrow]);

  return null;
}

export default function Scene() {
  const [flyingDarts, setFlyingDarts] = useState<FlyingDartData[]>([]);
  const [stuckDarts, setStuckDarts] = useState<ThrownDart[]>([]);

  const handleDartThrow = (position: [number, number, number]) => {
    const dartId = `${Date.now()}-${Math.random()}`;

    // 먼저 날아가는 다트로 추가
    setFlyingDarts((prev) => [
      ...prev,
      {
        id: dartId,
        position,
      },
    ]);

    // 애니메이션 시간 후 꽂힌 다트로 이동
    setTimeout(() => {
      setFlyingDarts((prev) => prev.filter((d) => d.id !== dartId));
      setStuckDarts((prev) => [...prev, { id: dartId, position }]);
    }, 700);
  };

  return (
    <>
      {/* DART_THROW 이벤트 핸들러 */}
      <DartEventHandler onDartThrow={handleDartThrow} />

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

      {/* 룰렛 모델 */}
      <RotatingRoulette flyingDarts={flyingDarts} stuckDarts={stuckDarts} />

      {/* 개발용 – 현장 배포 전 제거 */}
      <OrbitControls enableZoom={false} />
    </>
  );
}

// 룰렛 모델 프리로드
useGLTF.preload("/models/roulette.glb");
// 다트 모델 프리로드
useGLTF.preload("/models/dart.glb");
