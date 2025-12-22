import { useGLTF } from "@react-three/drei";

export function preloadModels() {
  useGLTF.preload("/models/target.glb");
}
