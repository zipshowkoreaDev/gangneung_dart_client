import { generateSessionToken } from "./session";

/**
 * 현재 환경의 베이스 URL 가져오기
 * 항상 완전한 URL 형식 반환 (http:// 또는 https:// 포함)
 */
export function getBaseUrl(): string {
  if (typeof window === "undefined") {
    // SSR: 환경 변수 또는 기본값
    return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  }

  const isProductionDomain =
    process.env.NEXT_PUBLIC_BASE_URL &&
    window.location.host === new URL(process.env.NEXT_PUBLIC_BASE_URL).host;

  if (isProductionDomain) {
    return process.env.NEXT_PUBLIC_BASE_URL!;
  }

  // 현재 브라우저 URL 사용 (http:// 또는 https:// 포함)
  return `${window.location.protocol}//${window.location.host}`;
}

/**
 * QR 인증 URL 생성 (세션 토큰 포함)
 * 완전한 URL 형식 보장
 */
export function generateAuthUrl(room: string): string {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    console.error("Base URL is empty!");
    return "";
  }

  const token = generateSessionToken();
  const url = `${baseUrl}/auth/${token}?room=${encodeURIComponent(room)}`;

  console.log("Generated QR URL:", url); // 디버깅용
  return url;
}
