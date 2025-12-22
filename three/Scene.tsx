import { OrbitControls } from "@react-three/drei";
import Target from "./Target";

export default function Scene() {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 20]} />

      <Target />

      {/* 개발용 – 현장 배포 전 제거 */}
      <OrbitControls enableZoom={false} />
    </>
  );
}
