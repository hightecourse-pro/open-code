import { NextResponse } from "next/server";
import { serviceAccountToken } from "@/lib/drive-api";
import { projectByK8 } from "@/lib/hackathon-showcase";

// A demo video can be 46 MB; the stream needs room.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const AS = () => process.env.GOOGLE_DRIVE_UPLOAD_AS?.trim() || undefined;
const PASS = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"];

/**
 * The demo video of a project in the employers' portal - PUBLIC, streamed through our own domain
 * (the Drive mirror is private to the service account; the uploaded file sits in a private bucket;
 * Netfree blocks both hosts). Range passes through, so the player seeks. The Drive mirror first
 * (the same identity on both environments), the uploaded file as the fallback.
 */
export async function GET(req: Request, { params }: { params: Promise<{ k8: string }> }) {
  const { k8 } = await params;
  const p = /^[0-9a-f]{8}$/i.test(k8) ? projectByK8(k8) : null;
  if (!p?.video?.drive && !p?.video?.storage) return new NextResponse("not found", { status: 404 });
  const range = req.headers.get("range") ?? undefined;
  const rangeHeader: Record<string, string> = range ? { range } : {};

  let upstream: Response | null = null;
  if (p.video.drive) {
    try {
      const token = await serviceAccountToken(DRIVE_SCOPE, AS());
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(p.video.drive)}?alt=media&supportsAllDrives=true`, {
        headers: { authorization: `Bearer ${token}`, ...rangeHeader },
        cache: "no-store",
        signal: AbortSignal.timeout(110_000),
      });
      if (res.ok && res.body) upstream = res;
    } catch {
      upstream = null;
    }
  }
  if (!upstream && p.video.storage) {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (base && key) {
      try {
        const res = await fetch(`${base}/storage/v1/object/hackathon/${p.video.storage.split("/").map(encodeURIComponent).join("/")}`, {
          headers: { apikey: key, authorization: `Bearer ${key}`, ...rangeHeader },
          cache: "no-store",
          signal: AbortSignal.timeout(110_000),
        });
        if (res.ok && res.body) upstream = res;
      } catch {
        upstream = null;
      }
    }
  }
  if (!upstream?.body) return new NextResponse("unavailable", { status: 503 });

  const headers = new Headers();
  for (const h of PASS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  const type = headers.get("content-type") ?? "";
  if (!type || type.startsWith("application/octet-stream")) headers.set("content-type", "video/mp4");
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  headers.set("content-disposition", "inline");
  headers.set("cache-control", "public, max-age=3600");
  headers.set("x-content-type-options", "nosniff");
  return new Response(upstream.body, { status: upstream.status, headers });
}
