import { generateSessionToken } from "./session";

export function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  }

  const isProductionDomain =
    process.env.NEXT_PUBLIC_BASE_URL &&
    window.location.host === new URL(process.env.NEXT_PUBLIC_BASE_URL).host;

  if (isProductionDomain) {
    return process.env.NEXT_PUBLIC_BASE_URL!;
  }

  return `${window.location.protocol}//${window.location.host}`;
}

export function generateAuthUrl(room: string, slot: 1 | 2): string {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return "";
  }

  const token = generateSessionToken();
  const url = `${baseUrl}/auth/${token}?room=${encodeURIComponent(
    room
  )}&slot=${slot}`;
  return url;
}
