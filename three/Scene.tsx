import { OrbitControls } from "@react-three/drei";
import MachineProcedural from "./MachineProcedural";
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

  // MachineProcedural과 동일한 치수 사용
  const machineW = 22;
  const machineH = 40;
  const frame = 1.2;
  const innerW = machineW - frame * 2;
  const innerH = machineH - frame * 2;

  // 격자 칸 크기
  const cellWidth = innerW / cols;
  const cellHeight = innerH / rows;

  // 그리드 시작점 (왼쪽 상단)
  const gridStartX = -innerW / 2;
  const gridStartY = innerH / 2;

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

      {/* 머신(배경) */}
      <MachineProcedural targetZ={0} scale={1} />

      {/* 8줄 x 6열 = 48개 모델 렌더링 */}
      {Array.from({ length: rows }).map((_, rowIndex) =>
        Array.from({ length: cols }).map((_, colIndex) => {
          // 각 칸의 중심 위치
          const cellCenterX = gridStartX + cellWidth * (colIndex + 0.5);

          // 각 칸의 바닥 위치 (중력 느낌)
          const cellBottomY = gridStartY - cellHeight * (rowIndex + 1);
          // 모델 높이의 절반만큼 위로 올려서 바닥에 닿게 함
          const y = cellBottomY + 0.8; // 0.8은 모델 높이의 절반 (조정 가능)

          const modelIndex = (rowIndex * cols + colIndex) % models.length;

          return (
            <Target
              key={`${rowIndex}-${colIndex}`}
              modelPath={models[modelIndex]}
              position={[cellCenterX, y, 0]}
            />
          );
        })
      )}

      {/* 개발용 – 현장 배포 전 제거 */}
      <OrbitControls enableZoom={false} />
    </>
  );
}
