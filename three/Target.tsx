import { useGLTF, useAnimations } from "@react-three/drei";
import { useEffect, useRef, useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import type { Group, Object3D } from "three";

interface TargetProps {
  modelPath: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

export default function Target({
  modelPath,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: TargetProps) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(modelPath);

  // SkeletonUtils로 애니메이션이 있는 모델을 제대로 clone
  const clonedScene = useMemo(() => {
    return SkeletonUtils.clone(scene) as Object3D;
  }, [scene]);

  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    // 모든 애니메이션 재생
    if (names.length > 0) {
      // 모든 애니메이션 재생
      names.forEach((name) => {
        const action = actions[name];
        if (action) {
          action.reset().play();
        }
      });
    }
  }, [actions, names, modelPath]);

  return (
    <primitive
      ref={group}
      object={clonedScene}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}
