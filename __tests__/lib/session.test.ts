import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setQRSession,
  getQRSession,
  clearQRSession,
  generateSessionToken,
  isValidTokenFormat,
} from "@/lib/session";

describe("lib/session", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe("setQRSession", () => {
    it("토큰을 sessionStorage에 저장", () => {
      setQRSession("test-token");

      expect(sessionStorage.getItem("qr_session_token")).toBe("test-token");
      expect(sessionStorage.getItem("qr_session_timestamp")).not.toBeNull();
    });

    it("타임스탬프가 현재 시간으로 저장", () => {
      const before = Date.now();
      setQRSession("test-token");
      const after = Date.now();

      const timestamp = parseInt(
        sessionStorage.getItem("qr_session_timestamp") || "0",
        10
      );
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("getQRSession", () => {
    it("SS-1-1: 저장된 토큰 조회", () => {
      setQRSession("valid-token");
      const result = getQRSession();

      expect(result).toBe("valid-token");
    });

    it("SS-1-2: 토큰이 없으면 null 반환", () => {
      const result = getQRSession();
      expect(result).toBeNull();
    });

    it("SS-1-3: 24시간 경과 시 null 반환 및 세션 삭제", () => {
      vi.useFakeTimers();

      setQRSession("expired-token");

      // 24시간 + 1초 경과
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000);

      const result = getQRSession();
      expect(result).toBeNull();

      // 세션이 삭제되었는지 확인
      expect(sessionStorage.getItem("qr_session_token")).toBeNull();
      expect(sessionStorage.getItem("qr_session_timestamp")).toBeNull();

      vi.useRealTimers();
    });

    it("24시간 이내면 토큰 반환", () => {
      vi.useFakeTimers();

      setQRSession("valid-token");

      // 23시간 59분 경과
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 - 60000);

      const result = getQRSession();
      expect(result).toBe("valid-token");

      vi.useRealTimers();
    });

    it("타임스탬프 없으면 null 반환", () => {
      sessionStorage.setItem("qr_session_token", "orphan-token");
      // 타임스탬프는 저장하지 않음

      const result = getQRSession();
      expect(result).toBeNull();
    });
  });

  describe("clearQRSession", () => {
    it("세션 데이터 모두 삭제", () => {
      setQRSession("to-be-cleared");

      clearQRSession();

      expect(sessionStorage.getItem("qr_session_token")).toBeNull();
      expect(sessionStorage.getItem("qr_session_timestamp")).toBeNull();
    });

    it("세션 없어도 에러 없음", () => {
      expect(() => clearQRSession()).not.toThrow();
    });
  });

  describe("generateSessionToken", () => {
    it("유효한 형식의 토큰 생성", () => {
      const token = generateSessionToken();

      expect(isValidTokenFormat(token)).toBe(true);
    });

    it("토큰에 타임스탬프 포함", () => {
      const before = Date.now();
      const token = generateSessionToken();
      const after = Date.now();

      const timestamp = parseInt(token.split("-")[0], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("매번 다른 토큰 생성", () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe("isValidTokenFormat", () => {
    it("SS-1-4: 유효한 토큰 형식 확인", () => {
      expect(isValidTokenFormat("1234567890-abc123")).toBe(true);
      expect(isValidTokenFormat("1609459200000-xyz789def")).toBe(true);
    });

    it("잘못된 형식 - 하이픈 없음", () => {
      expect(isValidTokenFormat("notokenformat")).toBe(false);
    });

    it("잘못된 형식 - 타임스탬프가 숫자 아님", () => {
      expect(isValidTokenFormat("abc-xyz")).toBe(false);
    });

    it("잘못된 형식 - 랜덤 문자열 없음", () => {
      expect(isValidTokenFormat("1234567890-")).toBe(false);
    });

    it("잘못된 형식 - 하이픈 여러 개", () => {
      expect(isValidTokenFormat("123-456-789")).toBe(false);
    });

    it("잘못된 형식 - 음수 타임스탬프", () => {
      expect(isValidTokenFormat("-1234567890-abc")).toBe(false);
    });

    it("잘못된 형식 - 빈 문자열", () => {
      expect(isValidTokenFormat("")).toBe(false);
    });
  });
});
