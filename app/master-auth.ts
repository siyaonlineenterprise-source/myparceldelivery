import { NextRequest } from "next/server";

export const masterCookieName = "mpd_master_session";

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(value: string) {
  const secret = process.env.MASTER_ADMIN_PASSCODE;
  if (!secret) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(signature));
}

export async function createMasterSession() {
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const payload = String(expiresAt);
  return { token: `${payload}.${await hmac(payload)}`, expiresAt };
}

export async function hasMasterSession(request: NextRequest) {
  const token = request.cookies.get(masterCookieName)?.value || "";
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || Number(expiresAt) <= Date.now()) return false;
  return signature === await hmac(expiresAt);
}

export async function isMasterPasscode(passcode: string) {
  const expected = process.env.MASTER_ADMIN_PASSCODE || "";
  if (!expected || passcode.length !== expected.length) return false;
  const expectedHash = await hmac(`passcode:${expected}`);
  const actualHash = await hmac(`passcode:${passcode}`);
  return expectedHash === actualHash;
}
