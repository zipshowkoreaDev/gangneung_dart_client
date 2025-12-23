"use client";

import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

function DartModel() {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/dart.glb");

  // 세로 축(Y)로 계속 회전
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.9; // 속도(원하면 0.5~1.5로 조절)
  });

  return (
    <group ref={groupRef}>
      {/* 필요 시 크기/위치 조절 */}
      <primitive object={scene} />
    </group>
  );
}

export default function DartPreview() {
  return (
    <Suspense fallback={null}>
      {/* 라이트는 최소만 */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.0} />
      <DartModel />
    </Suspense>
  );
}

// drei GLTF 캐시 프리로드(선택)
useGLTF.preload("/models/dart.glb");
