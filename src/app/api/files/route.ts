import { NextResponse } from "next/server";
import { STORAGE_OBJECT_PREFIX, isOurStorageUrl } from "@/lib/netfree";

export const dynamic = "force-dynamic";
// A 10 MB attachment or a long syllabus streams through in seconds; give it room.
export const maxDuration = 60;

/**
 * Streams ONE object of our Supabase storage through our own domain, because
 * Netfree blocks the storage host (see src/lib/netfree.ts).
 *
 *   /api/files?u=<storage url>[&download=<file name>]
 *
 * Only two shapes of `u` are accepted, both on OUR storage host:
 *   …/storage/v1/object/public/<bucket>/<path>   - public buckets, no auth
 *   …/storage/v1/object/sign/<bucket>/<path>?token=… - a signed URL the app
 *     produced for this viewer; the token is the authorisation, exactly as it
 *     would be on the storage host itself.
 * Anything else (another host, an unsigned private path) is refused, so this
 * is not an open proxy. Range requests pass through for in-browser PDFs.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const u = url.searchParams.get("u") ?? "";
  const download = url.searchParams.get("download")?.trim() || null;
  if (!isOurStorageUrl(u)) return NextResponse.json({ error: "not a storage url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  const objectPath = target.href.slice(STORAGE_OBJECT_PREFIX.length);
  const isPublic = objectPath.startsWith("public/");
  const isSigned = objectPath.startsWith("sign/") && !!target.searchParams.get("token");
  if (!isPublic && !isSigned) return NextResponse.json({ error: "not allowed" }, { status: 400 });

  const range = req.headers.get("range");
  const upstream = await fetch(target, { cache: "no-store", headers: range ? { range } : undefined });
  if (!upstream.ok && upstream.status !== 206 && upstream.status !== 304) {
    return new NextResponse(upstream.status === 404 ? "not found" : "unavailable", {
      status: upstream.status === 404 || upstream.status === 400 ? 404 : 502,
    });
  }

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("cache-control", isPublic ? "public, max-age=3600" : "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  // The file name: an explicit download wins, then whatever storage decided
  // (a signed URL made with {download}), then the object's own name - inline.
  const baseName = decodeURIComponent(target.pathname.split("/").pop() ?? "file");
  const upstreamDisposition = upstream.headers.get("content-disposition");
  if (download) {
    headers.set("content-disposition", `attachment; filename="${asciiName(download)}"; filename*=UTF-8''${encodeURIComponent(download)}`);
  } else if (upstreamDisposition) {
    headers.set("content-disposition", upstreamDisposition);
  } else {
    headers.set("content-disposition", `inline; filename="${asciiName(baseName)}"; filename*=UTF-8''${encodeURIComponent(baseName)}`);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

/** Header-safe ASCII fallback for a file name (the UTF-8 one travels in filename*). */
function asciiName(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, "").replace(/[\\/"]/g, "_").trim();
  return ascii || "file";
}
