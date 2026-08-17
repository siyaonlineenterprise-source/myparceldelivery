import { NextRequest, NextResponse } from "next/server";
import { getDriveVideo } from "../../google-workspace";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const driveFileId = String(request.nextUrl.searchParams.get("driveFileId") || "");
  if (/^[A-Za-z0-9_-]{10,}$/.test(driveFileId)) {
    try {
      const driveResponse = await getDriveVideo(driveFileId);
      const headers = new Headers();
      headers.set("Content-Type", driveResponse.headers.get("Content-Type") || "video/webm");
      const contentLength = driveResponse.headers.get("Content-Length");
      if (contentLength) headers.set("Content-Length", contentLength);
      headers.set("Cache-Control", "private, max-age=3600");
      headers.set("Content-Disposition", "inline");
      headers.set("Accept-Ranges", "bytes");
      return new Response(driveResponse.body, { headers });
    } catch {
      return NextResponse.json({ error: "Video Drive se load nahi hui" }, { status: 502 });
    }
  }
  const key = String(request.nextUrl.searchParams.get("key") || "");
  if (!/^(packing|return)\/\d+\/[a-f0-9-]+\.(webm|mp4)$/.test(key)) {
    return NextResponse.json({ error: "Invalid video" }, { status: 400 });
  }
  const { env } = await import("cloudflare:workers");
  if (!env.BUCKET) return NextResponse.json({ error: "Video storage unavailable" }, { status: 503 });
  const object = await env.BUCKET.get(key);
  if (!object) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Content-Disposition", "inline");
  return new Response(object.body, { headers });
}
