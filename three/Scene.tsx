import { OrbitControls } from "@react-three/drei";
import Target from "./Target";

export default function Scene() {
  // 8줄 x 6열 그리드 생성
  const rows = 8;
  const cols = 6;
  const models = [
    "/test/model_1.glb",
    "/test/model_2.glb",
    "/test/model_3.glb",
  ];

  // 그리드 간격
  const colSpacing = 3; // 가로 간격
  const rowSpacing = 4; // 세로 간격

  // 중앙 정렬을 위한 오프셋
  const xOffset = -((cols - 1) * colSpacing) / 2;
  const yOffset = ((rows - 1) * rowSpacing) / 2;

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

      {/* 8줄 x 6열 = 48개 모델 렌더링 */}
      {Array.from({ length: rows }).map((_, rowIndex) =>
        Array.from({ length: cols }).map((_, colIndex) => {
          const x = xOffset + colIndex * colSpacing;
          const y = yOffset - rowIndex * rowSpacing;
          const modelIndex = (rowIndex * cols + colIndex) % models.length;

          return (
            <Target
              key={`${rowIndex}-${colIndex}`}
              modelPath={models[modelIndex]}
              position={[x, y, 0]}
            />
          );
        })
      )}

      {/* 개발용 – 현장 배포 전 제거 */}
      <OrbitControls enableZoom={false} />
    </>
  );
}
