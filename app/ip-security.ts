import { NextRequest } from "next/server";

const DEVICE_COOKIE = "mpd_device_id";

function normalizeIp(value: string) {
  const first = value.split(",")[0]?.trim() || "";
  return first.replace(/^\[|\]$/g, "").slice(0, 80);
}

export function requestIp(request: NextRequest) {
  return normalizeIp(
    request.headers.get("cf-connecting-ip")
      || request.headers.get("x-real-ip")
      || request.headers.get("x-forwarded-for")
      || "unknown",
  );
}

export async function hashIp(ip: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`mpd-ip-v1:${normalizeIp(ip)}`),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function maskedIp(ip: string) {
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return `${parts.slice(0, 2).join(":") || "IPv6"}:••••`;
  }
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.•••.•••` : "Protected IP";
}

export function deviceTokenFrom(request: NextRequest) {
  return request.cookies.get(DEVICE_COOKIE)?.value?.trim().slice(0, 100) || "";
}

export function deviceCookieName() {
  return DEVICE_COOKIE;
}
