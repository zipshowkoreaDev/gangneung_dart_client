import { useGLTF } from "@react-three/drei";

export default function Target() {
  const { scene } = useGLTF("/models/target.glb");
  return <primitive object={scene} />;
}
