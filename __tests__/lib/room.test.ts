import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getPlayerRoom,
  getDisplayRoom,
  getAllPlayerRooms,
  extractPlayerSlot,
  isPlayerRoom,
  isDisplayRoom,
  assignEmptySlot,
  releaseSlot,
  refreshSlot,
  clearAllSlots,
  getSlotFromPosition,
} from "@/lib/room";

describe("lib/room", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getPlayerRoom", () => {
    it("RM-1-1: 슬롯 1 방 이름 생성", () => {
      const result = getPlayerRoom("zipshow", 1);
      expect(result).toBe("game-zipshow-player1");
    });

    it("RM-1-2: 슬롯 2 방 이름 생성", () => {
      const result = getPlayerRoom("zipshow", 2);
      expect(result).toBe("game-zipshow-player2");
    });

    it("RM-1-3: 다른 방 이름으로 생성", () => {
      const result = getPlayerRoom("testroom", 1);
      expect(result).toBe("game-testroom-player1");
    });
  });

  describe("getDisplayRoom", () => {
    it("RM-2-1: 디스플레이 방 이름 생성", () => {
      const result = getDisplayRoom("zipshow");
      expect(result).toBe("game-zipshow-display");
    });
  });

  describe("getAllPlayerRooms", () => {
    it("RM-2-2: 모든 플레이어 방 목록 반환", () => {
      const result = getAllPlayerRooms("zipshow");
      expect(result).toEqual([
        "game-zipshow-player1",
        "game-zipshow-player2",
      ]);
    });
  });

  describe("extractPlayerSlot", () => {
    it("RM-5-1: player1 방에서 슬롯 1 추출", () => {
      const result = extractPlayerSlot("game-zipshow-player1");
      expect(result).toBe(1);
    });

    it("RM-5-2: player2 방에서 슬롯 2 추출", () => {
      const result = extractPlayerSlot("game-zipshow-player2");
      expect(result).toBe(2);
    });

    it("RM-5-3: 디스플레이 방은 null 반환", () => {
      const result = extractPlayerSlot("game-zipshow-display");
      expect(result).toBeNull();
    });

    it("RM-5-4: 잘못된 형식은 null 반환", () => {
      const result = extractPlayerSlot("invalid-room");
      expect(result).toBeNull();
    });
  });

  describe("isPlayerRoom", () => {
    it("플레이어 방 확인 - true", () => {
      expect(isPlayerRoom("game-zipshow-player1")).toBe(true);
      expect(isPlayerRoom("game-zipshow-player2")).toBe(true);
    });

    it("플레이어 방 확인 - false", () => {
      expect(isPlayerRoom("game-zipshow-display")).toBe(false);
      expect(isPlayerRoom("invalid")).toBe(false);
    });
  });

  describe("isDisplayRoom", () => {
    it("디스플레이 방 확인 - true", () => {
      expect(isDisplayRoom("game-zipshow-display")).toBe(true);
    });

    it("디스플레이 방 확인 - false", () => {
      expect(isDisplayRoom("game-zipshow-player1")).toBe(false);
      expect(isDisplayRoom("invalid")).toBe(false);
    });
  });

  describe("getSlotFromPosition", () => {
    it("position 0은 슬롯 1", () => {
      expect(getSlotFromPosition(0)).toBe(1);
    });

    it("position 1은 슬롯 2", () => {
      expect(getSlotFromPosition(1)).toBe(2);
    });

    it("position 2 이상은 null", () => {
      expect(getSlotFromPosition(2)).toBeNull();
      expect(getSlotFromPosition(99)).toBeNull();
    });
  });

  describe("assignEmptySlot", () => {
    it("RM-3-1: 빈 상태에서 슬롯 1 할당", () => {
      const result = assignEmptySlot("zipshow");
      expect(result).toBe(1);
    });

    it("RM-3-2: 슬롯 1 점유 시 슬롯 2 할당", () => {
      assignEmptySlot("zipshow");
      const result = assignEmptySlot("zipshow");
      expect(result).toBe(2);
    });

    it("RM-3-3: 모두 점유 시 null 반환", () => {
      assignEmptySlot("zipshow");
      assignEmptySlot("zipshow");
      const result = assignEmptySlot("zipshow");
      expect(result).toBeNull();
    });

    it("RM-3-4: 1분 후 만료되어 재할당", () => {
      vi.useFakeTimers();

      assignEmptySlot("zipshow");
      assignEmptySlot("zipshow");

      // 1분 + 1초 경과
      vi.advanceTimersByTime(61 * 1000);

      const result = assignEmptySlot("zipshow");
      expect(result).toBe(1);

      vi.useRealTimers();
    });
  });

  describe("releaseSlot", () => {
    it("RM-4-1: 점유된 슬롯 해제", () => {
      assignEmptySlot("zipshow");
      releaseSlot("zipshow", 1);

      const result = assignEmptySlot("zipshow");
      expect(result).toBe(1);
    });

    it("RM-4-2: 빈 슬롯 해제해도 에러 없음", () => {
      expect(() => releaseSlot("zipshow", 1)).not.toThrow();
    });

    it("슬롯 1 해제 후 슬롯 2는 유지", () => {
      assignEmptySlot("zipshow"); // 슬롯 1
      assignEmptySlot("zipshow"); // 슬롯 2

      releaseSlot("zipshow", 1);

      const result = assignEmptySlot("zipshow");
      expect(result).toBe(1); // 슬롯 1이 비어서 다시 할당
    });
  });

  describe("refreshSlot", () => {
    it("슬롯 갱신 시 만료 시간 연장", () => {
      vi.useFakeTimers();

      assignEmptySlot("zipshow");

      // 30초 경과
      vi.advanceTimersByTime(30 * 1000);
      refreshSlot("zipshow", 1);

      // 추가 30초 경과 (총 60초)
      vi.advanceTimersByTime(30 * 1000);

      // 갱신했으므로 아직 만료 안됨
      const result = assignEmptySlot("zipshow");
      expect(result).toBe(2);

      vi.useRealTimers();
    });
  });

  describe("clearAllSlots", () => {
    it("모든 슬롯 초기화", () => {
      assignEmptySlot("zipshow");
      assignEmptySlot("zipshow");

      clearAllSlots("zipshow");

      const result = assignEmptySlot("zipshow");
      expect(result).toBe(1);
    });
  });
});
