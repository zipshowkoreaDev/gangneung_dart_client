import { useGLTF, useAnimations } from "@react-three/drei";
import { useEffect, useRef, useState, useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import type { Group, Object3D, Mesh } from "three";
import { useFrame } from "@react-three/fiber";
import { LoopOnce, AdditiveBlending, Color } from "three";
import * as THREE from "three";

interface HitEffectProps {
  position: [number, number, number];
  onComplete?: () => void;
}

// 볼륨 클라우드를 위한 파티클 생성
function createCloudParticles(count: number) {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const randomValues = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // 구 형태로 파티클 분포
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 0.5 + Math.random() * 1.5;

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    scales[i] = 0.3 + Math.random() * 0.7;
    randomValues[i] = Math.random();
  }

  return { positions, scales, randomValues };
}

export default function HitEffect({ position, onComplete }: HitEffectProps) {
  const cloudRef = useRef<Group>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const popRef = useRef<Group>(null);
  const [phase, setPhase] = useState<"cloud" | "pop" | "done">("cloud");
  const [cloudOpacity, setCloudOpacity] = useState(0);
  const [cloudScale, setCloudScale] = useState(0.1);
  const [popScale, setPopScale] = useState(0);
  const timeRef = useRef(0);

  // 클라우드 파티클 데이터
  const cloudParticles = useMemo(() => createCloudParticles(100), []);

  // pop.glb 모델 로드 및 재질 보존
  const { scene, animations } = useGLTF("/models/pop.glb");
  const clonedScene = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene) as Object3D;
    // 재질 보존 및 개선
    cloned.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        if (mesh.material) {
          // 재질이 배열인 경우
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((mat) => mat.clone());
          } else {
            mesh.material = mesh.material.clone();
          }
        }
      }
    });
    return cloned;
  }, [scene]);

  const { actions, names } = useAnimations(animations, popRef);

  // 애니메이션 타이밍 제어
  useEffect(() => {
    // 1단계: 클라우드 확장 및 페이드 인 (0.3초)
    const cloudGrow = setInterval(() => {
      setCloudOpacity((prev) => Math.min(prev + 0.05, 0.9));
      setCloudScale((prev) => Math.min(prev + 0.08, 1.2));
    }, 16);

    // 2단계: 클라우드가 타겟을 가린 후 pop 표시 (0.5초 후)
    const showPop = setTimeout(() => {
      clearInterval(cloudGrow);
      setPhase("pop");
      setPopScale(0.01);

      // pop 스케일 애니메이션
      let scale = 0.01;
      const popGrow = setInterval(() => {
        scale += 0.08;
        if (scale >= 1) {
          setPopScale(1);
          clearInterval(popGrow);
        } else {
          setPopScale(scale);
        }
      }, 16);

      // pop.glb 애니메이션 재생
      if (names.length > 0) {
        names.forEach((name) => {
          const action = actions[name];
          if (action) {
            action.reset();
            action.setLoop(LoopOnce, 1);
            action.clampWhenFinished = true;
            action.play();
          }
        });
      }
    }, 500);

    // 3단계: 완료 후 정리 (2초 후)
    const cleanup = setTimeout(() => {
      setPhase("done");
      onComplete?.();
    }, 2500);

    return () => {
      clearInterval(cloudGrow);
      clearTimeout(showPop);
      clearTimeout(cleanup);
    };
  }, [actions, names, onComplete]);

  // 클라우드 애니메이션 (회전 + 파티클 움직임)
  useFrame((state, delta) => {
    timeRef.current += delta;

    if (cloudRef.current && phase === "cloud") {
      cloudRef.current.rotation.y += delta * 0.5;
      cloudRef.current.rotation.z += delta * 0.3;
    }

    if (particlesRef.current && phase === "cloud") {
      const positions = particlesRef.current.geometry.attributes.position
        .array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(timeRef.current + i) * 0.002;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  if (phase === "done") return null;

  return (
    <group position={position}>
      {/* 3D 볼륨 클라우드 효과 */}
      {phase === "cloud" && (
        <group ref={cloudRef} scale={cloudScale}>
          {/* 파티클 기반 볼륨 클라우드 */}
          <points ref={particlesRef}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[cloudParticles.positions, 3]}
              />
            </bufferGeometry>
            <pointsMaterial
              size={0.6}
              color={new Color(0xffffff)}
              transparent
              opacity={cloudOpacity}
              blending={AdditiveBlending}
              depthWrite={false}
              sizeAttenuation={true}
            />
          </points>

          {/* 볼륨감을 위한 반투명 구체들 */}
          {Array.from({ length: 15 }).map((_, i) => {
            const theta = (i / 15) * Math.PI * 2;
            const phi = Math.acos(2 * (i / 15) - 1);
            const radius = 0.8 + (i % 3) * 0.3;
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi) * 0.5;
            const scale = 0.4 + (i % 4) * 0.15;

            return (
              <mesh key={i} position={[x, y, z]}>
                <sphereGeometry args={[scale, 16, 16]} />
                <meshStandardMaterial
                  color="#ffffff"
                  transparent
                  opacity={cloudOpacity * 0.4}
                  emissive="#e0e0ff"
                  emissiveIntensity={0.6}
                  roughness={0.8}
                  metalness={0.1}
                  blending={AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            );
          })}

          {/* 중앙 코어 */}
          <mesh>
            <sphereGeometry args={[1.2, 32, 32]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent
              opacity={cloudOpacity * 0.6}
              emissive="#ffffff"
              emissiveIntensity={0.8}
              roughness={0.5}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {/* Pop 애니메이션 - 3D 재질 보존 */}
      {phase === "pop" && (
        <primitive
          ref={popRef}
          object={clonedScene}
          scale={popScale}
          position={[0, 0, 0.5]}
        />
      )}
    </group>
  );
}

// 모델 프리로드
useGLTF.preload("/models/pop.glb");
