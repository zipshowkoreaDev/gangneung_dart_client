import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSlotManager } from "@/hooks/useSlotManager";

describe("hooks/useSlotManager", () => {
  describe("초기 상태", () => {
    it("모든 슬롯이 비어있음", () => {
      const { result } = renderHook(() => useSlotManager({}));

      expect(result.current.slots[0].isActive).toBe(false);
      expect(result.current.slots[1].isActive).toBe(false);
      expect(result.current.slots[0].playerName).toBeNull();
      expect(result.current.slots[1].playerName).toBeNull();
    });
  });

  describe("assignSlot", () => {
    it("SM-1-1: 첫 플레이어는 슬롯 1에 할당", () => {
      const { result } = renderHook(() => useSlotManager({}));

      let slot: number | null = null;
      act(() => {
        slot = result.current.assignSlot("홍길동");
      });

      expect(slot).toBe(1);
      expect(result.current.slots[0].playerName).toBe("홍길동");
      expect(result.current.slots[0].isActive).toBe(true);
    });

    it("SM-1-2: 두번째 플레이어는 슬롯 2에 할당", () => {
      const { result } = renderHook(() => useSlotManager({}));

      act(() => {
        result.current.assignSlot("홍길동");
      });

      let slot: number | null = null;
      act(() => {
        slot = result.current.assignSlot("김철수");
      });

      expect(slot).toBe(2);
      expect(result.current.slots[1].playerName).toBe("김철수");
      expect(result.current.slots[1].isActive).toBe(true);
    });

    it("SM-1-3: 세번째 플레이어는 null 반환 (슬롯 만원)", () => {
      const { result } = renderHook(() => useSlotManager({}));

      act(() => {
        result.current.assignSlot("홍길동");
      });
      act(() => {
        result.current.assignSlot("김철수");
      });

      let slot: number | null = null;
      act(() => {
        slot = result.current.assignSlot("이영희");
      });

      expect(slot).toBeNull();
    });

    it("onLog 콜백 호출", () => {
      const onLog = vi.fn();
      const { result } = renderHook(() => useSlotManager({ onLog }));

      act(() => {
        result.current.assignSlot("홍길동");
      });

      expect(onLog).toHaveBeenCalledWith("✅ 슬롯 할당: 홍길동 → player1");
    });

    it("슬롯 만원 시 onLog 콜백 호출", () => {
      const onLog = vi.fn();
      const { result } = renderHook(() => useSlotManager({ onLog }));

      act(() => {
        result.current.assignSlot("홍길동");
      });
      act(() => {
        result.current.assignSlot("김철수");
      });
      act(() => {
        result.current.assignSlot("이영희");
      });

      expect(onLog).toHaveBeenCalledWith("❌ 슬롯 만원: 이영희 입장 거부");
    });
  });

  describe("releaseSlot", () => {
    it("SM-2-1: 슬롯 해제 시 해당 자리만 비워짐", () => {
      const { result } = renderHook(() => useSlotManager({}));

      act(() => {
        result.current.assignSlot("홍길동");
      });
      act(() => {
        result.current.assignSlot("김철수");
      });

      act(() => {
        result.current.releaseSlot("홍길동");
      });

      expect(result.current.slots[0].isActive).toBe(false);
      expect(result.current.slots[0].playerName).toBeNull();
      // 슬롯 2는 그대로 유지
      expect(result.current.slots[1].isActive).toBe(true);
      expect(result.current.slots[1].playerName).toBe("김철수");
    });

    it("SM-2-2: 존재하지 않는 플레이어 해제 시 변화 없음", () => {
      const { result } = renderHook(() => useSlotManager({}));

      act(() => {
        result.current.assignSlot("홍길동");
      });

      act(() => {
        result.current.releaseSlot("없는사람");
      });

      expect(result.current.slots[0].isActive).toBe(true);
      expect(result.current.slots[0].playerName).toBe("홍길동");
    });

    it("해제 후 빈 슬롯에 새 플레이어 할당 가능", () => {
      const { result } = renderHook(() => useSlotManager({}));

      act(() => {
        result.current.assignSlot("홍길동");
      });
      act(() => {
        result.current.assignSlot("김철수");
      });

      act(() => {
        result.current.releaseSlot("홍길동");
      });

      let slot: number | null = null;
      act(() => {
        slot = result.current.assignSlot("이영희");
      });

      expect(slot).toBe(1);
      expect(result.current.slots[0].playerName).toBe("이영희");
    });

    it("onLog 콜백 호출", () => {
      const onLog = vi.fn();
      const { result } = renderHook(() => useSlotManager({ onLog }));

      act(() => {
        result.current.assignSlot("홍길동");
      });

      act(() => {
        result.current.releaseSlot("홍길동");
      });

      expect(onLog).toHaveBeenCalledWith(
        "🚪 슬롯 해제: 홍길동 (player1 자리 비워짐)"
      );
    });
  });

  describe("resetSlots", () => {
    it("모든 슬롯 초기화", () => {
      const { result } = renderHook(() => useSlotManager({}));

      act(() => {
        result.current.assignSlot("홍길동");
        result.current.assignSlot("김철수");
      });

      act(() => {
        result.current.resetSlots();
      });

      expect(result.current.slots[0].isActive).toBe(false);
      expect(result.current.slots[1].isActive).toBe(false);
      expect(result.current.slots[0].playerName).toBeNull();
      expect(result.current.slots[1].playerName).toBeNull();
    });

    it("onLog 콜백 호출", () => {
      const onLog = vi.fn();
      const { result } = renderHook(() => useSlotManager({ onLog }));

      act(() => {
        result.current.resetSlots();
      });

      expect(onLog).toHaveBeenCalledWith("🔄 모든 슬롯 초기화");
    });
  });

  describe("getSlotInfo", () => {
    it("슬롯 정보 조회", () => {
      const { result } = renderHook(() => useSlotManager({}));

      act(() => {
        result.current.assignSlot("홍길동");
      });

      const info = result.current.getSlotInfo(1);
      expect(info.playerName).toBe("홍길동");
      expect(info.isActive).toBe(true);
    });

    it("빈 슬롯 정보 조회", () => {
      const { result } = renderHook(() => useSlotManager({}));

      const info = result.current.getSlotInfo(2);
      expect(info.playerName).toBeNull();
      expect(info.isActive).toBe(false);
    });
  });

  describe("findSlotByPlayer", () => {
    it("플레이어의 슬롯 번호 찾기", () => {
      const { result } = renderHook(() => useSlotManager({}));

      act(() => {
        result.current.assignSlot("홍길동");
      });
      act(() => {
        result.current.assignSlot("김철수");
      });

      expect(result.current.findSlotByPlayer("홍길동")).toBe(1);
      expect(result.current.findSlotByPlayer("김철수")).toBe(2);
    });

    it("없는 플레이어는 null 반환", () => {
      const { result } = renderHook(() => useSlotManager({}));

      expect(result.current.findSlotByPlayer("없는사람")).toBeNull();
    });
  });

  describe("findEmptySlot", () => {
    it("빈 슬롯 찾기 - 모두 비어있으면 1 반환", () => {
      const { result } = renderHook(() => useSlotManager({}));

      expect(result.current.findEmptySlot()).toBe(1);
    });

    it("빈 슬롯 찾기 - 슬롯 1 점유 시 2 반환", () => {
      const { result } = renderHook(() => useSlotManager({}));

      act(() => {
        result.current.assignSlot("홍길동");
      });

      expect(result.current.findEmptySlot()).toBe(2);
    });

    it("빈 슬롯 찾기 - 모두 점유 시 null 반환", () => {
      const { result } = renderHook(() => useSlotManager({}));

      act(() => {
        result.current.assignSlot("홍길동");
      });
      act(() => {
        result.current.assignSlot("김철수");
      });

      expect(result.current.findEmptySlot()).toBeNull();
    });
  });
});
