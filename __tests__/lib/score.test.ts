import { describe, it, expect } from "vitest";
import {
  clamp,
  aimTo3D,
  getZoneFromRatio,
  getScoreFromZone,
  getHitScoreFromAim,
  getZoneFromAim,
  ZONE_RATIOS,
  SCORES,
  DEFAULT_ROULETTE_RADIUS,
} from "@/lib/score";

describe("lib/score", () => {
  describe("clamp", () => {
    it("값이 범위 내면 그대로 반환", () => {
      expect(clamp(0.5, 0, 1)).toBe(0.5);
    });

    it("값이 최소값 미만이면 최소값 반환", () => {
      expect(clamp(-2, -1, 1)).toBe(-1);
    });

    it("값이 최대값 초과면 최대값 반환", () => {
      expect(clamp(2, -1, 1)).toBe(1);
    });
  });

  describe("aimTo3D", () => {
    it("원점은 원점으로 변환", () => {
      const result = aimTo3D({ x: 0, y: 0 });
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it("양수 좌표 변환", () => {
      const result = aimTo3D({ x: 1, y: 1 });
      expect(result.x).toBeGreaterThan(0);
      expect(result.y).toBeGreaterThan(0);
    });

    it("음수 좌표 변환", () => {
      const result = aimTo3D({ x: -1, y: -1 });
      expect(result.x).toBeLessThan(0);
      expect(result.y).toBeLessThan(0);
    });
  });

  describe("getZoneFromRatio", () => {
    it("Bull 영역 (0 ~ 8%)", () => {
      expect(getZoneFromRatio(0)).toBe("BULL");
      expect(getZoneFromRatio(0.05)).toBe("BULL");
      expect(getZoneFromRatio(ZONE_RATIOS.BULL)).toBe("BULL");
    });

    it("Inner Single 영역 (8% ~ 47%)", () => {
      expect(getZoneFromRatio(0.1)).toBe("SINGLE");
      expect(getZoneFromRatio(0.3)).toBe("SINGLE");
      expect(getZoneFromRatio(ZONE_RATIOS.INNER_SINGLE)).toBe("SINGLE");
    });

    it("Triple 영역 (47% ~ 54%)", () => {
      expect(getZoneFromRatio(0.5)).toBe("TRIPLE");
      expect(getZoneFromRatio(ZONE_RATIOS.TRIPLE)).toBe("TRIPLE");
    });

    it("Outer Single 영역 (54% ~ 93%)", () => {
      expect(getZoneFromRatio(0.6)).toBe("SINGLE");
      expect(getZoneFromRatio(0.8)).toBe("SINGLE");
      expect(getZoneFromRatio(ZONE_RATIOS.OUTER_SINGLE)).toBe("SINGLE");
    });

    it("Double 영역 (93% ~ 100%)", () => {
      expect(getZoneFromRatio(0.95)).toBe("DOUBLE");
      expect(getZoneFromRatio(ZONE_RATIOS.DOUBLE)).toBe("DOUBLE");
    });

    it("Miss 영역 (100% 초과)", () => {
      expect(getZoneFromRatio(1.1)).toBe("MISS");
      expect(getZoneFromRatio(2)).toBe("MISS");
    });
  });

  describe("getScoreFromZone", () => {
    it("Bull = 50점", () => {
      expect(getScoreFromZone("BULL")).toBe(SCORES.BULL);
      expect(getScoreFromZone("BULL")).toBe(50);
    });

    it("Triple = 30점", () => {
      expect(getScoreFromZone("TRIPLE")).toBe(SCORES.TRIPLE);
      expect(getScoreFromZone("TRIPLE")).toBe(30);
    });

    it("Double = 20점", () => {
      expect(getScoreFromZone("DOUBLE")).toBe(SCORES.DOUBLE);
      expect(getScoreFromZone("DOUBLE")).toBe(20);
    });

    it("Single = 10점", () => {
      expect(getScoreFromZone("SINGLE")).toBe(SCORES.SINGLE);
      expect(getScoreFromZone("SINGLE")).toBe(10);
    });

    it("Miss = 0점", () => {
      expect(getScoreFromZone("MISS")).toBe(SCORES.MISS);
      expect(getScoreFromZone("MISS")).toBe(0);
    });
  });

  describe("getHitScoreFromAim", () => {
    it("SC-1-1: 정중앙 (Bull) = 50점", () => {
      expect(getHitScoreFromAim({ x: 0, y: 0 })).toBe(50);
    });

    it("SC-1-2: Bull 경계 = 50점", () => {
      expect(getHitScoreFromAim({ x: 0.02, y: 0.02 })).toBe(50);
    });

    it("SC-1-3: Inner Single 영역 = 10점", () => {
      expect(getHitScoreFromAim({ x: 0.15, y: 0.15 })).toBe(10);
    });

    it("SC-1-4: Triple 영역 = 30점", () => {
      // ratio 0.5 → aim ≈ 0.177
      expect(getHitScoreFromAim({ x: 0.18, y: 0 })).toBe(30);
    });

    it("SC-1-5: Outer Single 영역 = 10점", () => {
      // ratio 0.75 → aim ≈ 0.266
      expect(getHitScoreFromAim({ x: 0.27, y: 0 })).toBe(10);
    });

    it("SC-1-6: Double 영역 = 20점", () => {
      // ratio 0.97 → aim ≈ 0.344
      expect(getHitScoreFromAim({ x: 0.34, y: 0 })).toBe(20);
    });

    it("SC-1-7: Miss (밖) = 0점", () => {
      expect(getHitScoreFromAim({ x: 1, y: 1 })).toBe(0);
    });

    it("SC-1-8: 음수 좌표도 정상 계산", () => {
      // 거리가 같으면 점수도 같아야 함
      const positiveScore = getHitScoreFromAim({ x: 0.3, y: 0.3 });
      const negativeScore = getHitScoreFromAim({ x: -0.3, y: -0.3 });
      expect(positiveScore).toBe(negativeScore);
    });

    it("aim이 undefined면 0점", () => {
      expect(getHitScoreFromAim(undefined)).toBe(0);
    });

    it("범위 초과 좌표는 clamp되어 계산", () => {
      // x: 2, y: 2는 x: 1, y: 1로 clamp됨
      const overScore = getHitScoreFromAim({ x: 2, y: 2 });
      const clampedScore = getHitScoreFromAim({ x: 1, y: 1 });
      expect(overScore).toBe(clampedScore);
    });

    it("커스텀 rouletteRadius 사용", () => {
      // 반지름이 작아지면 같은 위치도 더 먼 거리로 계산됨
      const smallRadius = DEFAULT_ROULETTE_RADIUS / 2;
      const normalScore = getHitScoreFromAim({ x: 0.2, y: 0.2 });
      const smallRadiusScore = getHitScoreFromAim({ x: 0.2, y: 0.2 }, smallRadius);

      // 반지름이 작으면 ratio가 커져서 더 바깥 영역으로 판정
      expect(smallRadiusScore).not.toBe(normalScore);
    });
  });

  describe("getZoneFromAim", () => {
    it("정중앙은 BULL", () => {
      expect(getZoneFromAim({ x: 0, y: 0 })).toBe("BULL");
    });

    it("외곽은 MISS", () => {
      expect(getZoneFromAim({ x: 1, y: 1 })).toBe("MISS");
    });
  });
});
