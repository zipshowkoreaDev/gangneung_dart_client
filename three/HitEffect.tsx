/* eslint-disable react-hooks/purity */
import { useGLTF, useAnimations } from "@react-three/drei";
import { useEffect, useRef, useState, useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import type { Group, Object3D } from "three";
import { useFrame } from "@react-three/fiber";
import { LoopOnce } from "three";

interface HitEffectProps {
  position: [number, number, number];
  onComplete?: () => void;
}

export default function HitEffect({ position, onComplete }: HitEffectProps) {
  const cloudRef = useRef<Group>(null);
  const popRef = useRef<Group>(null);
  const [phase, setPhase] = useState<"cloud" | "pop" | "done">("cloud");
  const [cloudOpacity, setCloudOpacity] = useState(0);
  const [popScale, setPopScale] = useState(0);

  // pop.glb 모델 로드
  const { scene, animations } = useGLTF("/models/pop.glb");
  const clonedScene = useMemo(() => {
    return SkeletonUtils.clone(scene) as Object3D;
  }, [scene]);

  const { actions, names } = useAnimations(animations, popRef);

  // 애니메이션 타이밍 제어
  useEffect(() => {
    // 1단계: 클라우드 페이드 인 (0.3초)
    const cloudFadeIn = setTimeout(() => {
      setCloudOpacity(1);
    }, 50);

    // 2단계: 클라우드가 타겟을 가린 후 pop 표시 (0.5초 후)
    const showPop = setTimeout(() => {
      setPhase("pop");
      setPopScale(1);

      // pop.glb 애니메이션 재생
      if (names.length > 0) {
        names.forEach((name) => {
          const action = actions[name];
          if (action) {
            action.reset();
            action.setLoop(LoopOnce, 1); // 한 번만 재생
            action.clampWhenFinished = true;
            action.play();
          }
        });
      }
    }, 500);

    // 3단계: 완료 후 정리 (1.5초 후)
    const cleanup = setTimeout(() => {
      setPhase("done");
      onComplete?.();
    }, 2000);

    return () => {
      clearTimeout(cloudFadeIn);
      clearTimeout(showPop);
      clearTimeout(cleanup);
    };
  }, [actions, names, onComplete]);

  // 클라우드 회전 애니메이션
  useFrame(() => {
    if (cloudRef.current && phase === "cloud") {
      cloudRef.current.rotation.z += 0.02;
    }
  });

  if (phase === "done") return null;

  return (
    <group position={position}>
      {/* 클라우드 효과 */}
      {phase === "cloud" && (
        <group ref={cloudRef}>
          {/* 여러 개의 구체로 클라우드 느낌 만들기 */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const radius = 1.5;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const scale = 0.8 + Math.random() * 0.4;

            return (
              <mesh key={i} position={[x, y, 0]}>
                <sphereGeometry args={[scale, 16, 16]} />
                <meshStandardMaterial
                  color="#ffffff"
                  transparent
                  opacity={cloudOpacity * 0.7}
                  emissive="#ffffff"
                  emissiveIntensity={0.3}
                />
              </mesh>
            );
          })}
          {/* 중앙 큰 구체 */}
          <mesh>
            <sphereGeometry args={[2, 32, 32]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent
              opacity={cloudOpacity * 0.8}
              emissive="#ffffff"
              emissiveIntensity={0.5}
            />
          </mesh>
        </group>
      )}

      {/* Pop 애니메이션 */}
      {phase === "pop" && (
        <primitive
          ref={popRef}
          object={clonedScene}
          scale={popScale}
          position={[0, 0, 0]}
        />
      )}
    </group>
  );
}

// 모델 프리로드
useGLTF.preload("/models/pop.glb");
