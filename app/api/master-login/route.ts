import { NextRequest, NextResponse } from "next/server";
import {
  createMasterSession,
  hasMasterSession,
  isMasterPasscode,
  masterCookieName,
} from "../../master-auth";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  if (!(await hasMasterSession(request))) {
    return NextResponse.json({ error: "Master login required" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { passcode?: string };
  const passcode = String(body.passcode || "").replace(/\D/g, "");
  if (!(await isMasterPasscode(passcode))) {
    return NextResponse.json({ error: "Master passcode galat hai" }, { status: 401 });
  }
  const { token, expiresAt } = await createMasterSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(masterCookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    expires: new Date(expiresAt),
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(masterCookieName, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
