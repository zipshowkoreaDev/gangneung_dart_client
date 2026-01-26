"use client";

import { ZONE_RATIOS } from "@/lib/score";
import { DISPLAY_AIM_BOUNDS, getDisplayAimBounds } from "@/lib/displayAimBounds";
import { DISPLAY_CANVAS_Y_OFFSET } from "@/lib/displayLayout";

type AimPosition = {
  x: number;
  y: number;
  skin?: string;
};

type AimOverlayProps = {
  aimPositions: Map<string, AimPosition>;
  playerOrder: string[];
  players: Map<string, { isReady: boolean; name?: string }>;
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
  const bounds = getDisplayAimBounds();
  const boundsStyle = {
    position: "absolute" as const,
    left: `${DISPLAY_AIM_BOUNDS.centerX * 100}%`,
    top: `${DISPLAY_AIM_BOUNDS.centerY * 100}%`,
    transform: "translate(-50%, -50%)",
    height: `${DISPLAY_AIM_BOUNDS.height * 100}%`,
    aspectRatio: `${DISPLAY_AIM_BOUNDS.aspect} / 1`,
    pointerEvents: "none" as const,
  };

  const zoneRings = [
    { ratio: ZONE_RATIOS.BULL, color: "#ff4d4d" },
    { ratio: ZONE_RATIOS.INNER_SINGLE, color: "#ffd54f" },
    { ratio: ZONE_RATIOS.TRIPLE, color: "#4caf50" },
    { ratio: ZONE_RATIOS.OUTER_SINGLE, color: "#ffa726" },
    { ratio: ZONE_RATIOS.DOUBLE, color: "#42a5f5" },
  ];

  return (
    <>
      {/*
      <div style={{ ...boundsStyle, zIndex: 1 }}>
        {zoneRings.map((ring) => (
          <div
            key={ring.ratio}
            style={{
              position: "absolute",
              left: "50%",
              top: "55.5%",
              transform: "translate(-50%, -50%)",
              width: `${ring.ratio * 80}%`,
              borderRadius: "50%",
              border: `2px solid ${ring.color}`,
              boxSizing: "border-box",
              aspectRatio: "1/1",
            }}
          />
        ))}
      </div>
      <div
        style={{
          ...boundsStyle,
          border: "4px solid #ff3b3b",
          zIndex: 2,
          boxSizing: "border-box",
        }}
      />
      */}
      {Array.from(aimPositions.entries())
        .filter(([]) => {
          // 모든 플레이어의 조준점 표시
          return true;
        })
        .map(([playerKey, pos]) => {
          // -1..1 → 0..1
          const x01 = (pos.x + 1) / 2;
          const y01 = (pos.y + 1) / 2 + DISPLAY_CANVAS_Y_OFFSET;
          const clampedX01 = Math.min(bounds.right, Math.max(bounds.left, x01));
          const clampedY01 = Math.min(bounds.bottom, Math.max(bounds.top, y01));

          const color = resolveColor(playerKey, playerOrder);

          return (
            <div key={playerKey}>
              {/* 조준점 원 */}
              <div
                style={{
                  position: "absolute",
                  left: `${clampedX01 * 100}%`,
                  top: `${clampedY01 * 100}%`,
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
                  left: `${clampedX01 * 100}%`,
                  top: `${clampedY01 * 100}%`,
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
                  left: `${clampedX01 * 100}%`,
                  top: `${clampedY01 * 100}%`,
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
                {players.get(playerKey)?.name ?? playerKey}
              </div>
            </div>
          );
        })}
    </>
  );
}
