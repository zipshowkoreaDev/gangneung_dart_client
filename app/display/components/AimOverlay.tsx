"use client";

type AimPosition = {
  x: number;
  y: number;
  skin?: string;
};

type AimOverlayProps = {
  aimPositions: Map<string, AimPosition>;
  playerOrder: string[];
  players: Map<string, { isReady: boolean }>;
};

function resolveColor(playerKey: string, playerOrder: string[]) {
  const index = playerOrder.indexOf(playerKey);
  // 첫 번째 플레이어: 빨강, 두 번째 플레이어: 파랑
  return index === 0 ? "#ff4d4d" : "#4da3ff";
}

export default function AimOverlay({
  aimPositions,
  playerOrder,
  players,
}: AimOverlayProps) {

  return (
    <>
      {Array.from(aimPositions.entries())
        .filter(([playerKey]) => {
          // 모든 플레이어의 조준점 표시
          return true;
        })
        .map(([playerKey, pos]) => {
          // -1..1 → 0..1
          const x01 = (pos.x + 1) / 2;
          const y01 = (pos.y + 1) / 2;

          const color = resolveColor(playerKey, playerOrder);

          return (
            <div key={playerKey}>
              {/* 조준점 원 */}
              <div
                style={{
                  position: "absolute",
                  left: `${x01 * 100}%`,
                  top: `${y01 * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: `4px solid ${color}`,
                  background: `${color}33`,
                  zIndex: 5,
                  pointerEvents: "none",
                  transition: "all 0.05s ease-out",
                }}
              />
              {/* 중심점 */}
              <div
                style={{
                  position: "absolute",
                  left: `${x01 * 100}%`,
                  top: `${y01 * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  zIndex: 6,
                  pointerEvents: "none",
                }}
              />
              {/* 플레이어 이름 */}
              <div
                style={{
                  position: "absolute",
                  left: `${x01 * 100}%`,
                  top: `${y01 * 100}%`,
                  transform: "translate(-50%, calc(-50% - 35px))",
                  background: "rgba(0, 0, 0, 0.7)",
                  color: "white",
                  padding: "4px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  zIndex: 7,
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {playerKey}
              </div>
            </div>
          );
        })}
    </>
  );
}
