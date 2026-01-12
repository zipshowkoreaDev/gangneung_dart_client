import { generateSessionToken } from "./session";

// 현재 환경의 베이스 URL 가져오기
export function getBaseUrl(): string {
  if (typeof window === "undefined") return "";

  const isProductionDomain =
    process.env.NEXT_PUBLIC_BASE_URL &&
    window.location.host === new URL(process.env.NEXT_PUBLIC_BASE_URL).host;

  return isProductionDomain
    ? process.env.NEXT_PUBLIC_BASE_URL!
    : `${window.location.protocol}//${window.location.host}`;
}

// QR 인증 URL 생성 (세션 토큰 포함)
export function generateAuthUrl(room: string): string {
  const baseUrl = getBaseUrl();
  const token = generateSessionToken();
  return `${baseUrl}/auth/${token}?room=${encodeURIComponent(room)}`;
}
