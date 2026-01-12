// QR 기반 현장 한정 접근 제어를 위한 세션 관리 유틸리티
// sessionStorage를 사용하여 브라우저 탭 단위로 세션을 격리

const SESSION_KEY = "qr_session_token";
const SESSION_TIMESTAMP_KEY = "qr_session_timestamp";
const SESSION_VALIDITY_MS = 24 * 60 * 60 * 1000; // 24시간

// QR 스캔을 통해 발급받은 세션 토큰을 저장
export function setQRSession(token: string): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(SESSION_KEY, token);
    sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error("Failed to set QR session:", error);
  }
}

// 현재 세션이 유효한지 확인
// @returns 세션이 유효하면 토큰 반환, 그렇지 않으면 null
export function getQRSession(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const token = sessionStorage.getItem(SESSION_KEY);
    const timestamp = sessionStorage.getItem(SESSION_TIMESTAMP_KEY);

    if (!token || !timestamp) {
      return null;
    }

    const sessionAge = Date.now() - parseInt(timestamp, 10);

    // 세션이 만료되었으면 제거
    if (sessionAge > SESSION_VALIDITY_MS) {
      clearQRSession();
      return null;
    }

    return token;
  } catch (error) {
    console.error("Failed to get QR session:", error);
    return null;
  }
}

// 세션 토큰 제거
export function clearQRSession(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_TIMESTAMP_KEY);
  } catch (error) {
    console.error("Failed to clear QR session:", error);
  }
}

// 고유 세션 토큰 생성
export function generateSessionToken(): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomStr}`;
}

// 세션 토큰 검증 (간단한 포맷 검증)
export function isValidTokenFormat(token: string): boolean {
  // timestamp-randomstring 형태 확인
  const parts = token.split("-");
  if (parts.length !== 2) return false;

  const timestamp = parseInt(parts[0], 10);
  if (isNaN(timestamp) || timestamp <= 0) return false;

  return parts[1].length > 0;
}
