import { NextResponse } from "next/server";
import { getProfile, isSubscriber } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// A 19 MB CSV streams through in a few seconds; give it room.
export const maxDuration = 120;

/**
 * Download a challenge's material - subscribers (and the team) only.
 *
 * The file is streamed THROUGH our domain rather than redirecting to the
 * storage host (the owner, 9/10: the virology PDFs "don't download well on
 * Netfree" - the filtered network blocks the storage host's signed links;
 * app.opencode.org.il is allowed). Same move as the Netfree-safe thumbnails.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.opencode.org.il";
  const profile = await getProfile();
  if (!profile) return NextResponse.redirect(new URL("/login?next=/hackathon", site));
  if (!isSubscriber(profile)) return NextResponse.redirect(new URL("/join?locked=hackathon", site));

  const admin = createAdminClient();
  const { data: m } = await admin.from("hackathon_materials").select("file_path, title, size_bytes").eq("id", id).maybeSingle();
  if (!m) return new NextResponse("not found", { status: 404 });
  const { data: signed, error } = await admin.storage.from("hackathon").createSignedUrl(m.file_path, 10 * 60);
  if (error || !signed?.signedUrl) return new NextResponse("unavailable", { status: 503 });

  const upstream = await fetch(signed.signedUrl, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) return new NextResponse("unavailable", { status: 503 });

  const ext = (m.file_path.split(".").pop() ?? "").toLowerCase();
  const type =
    ext === "pdf" ? "application/pdf"
    : ext === "csv" ? "text/csv; charset=windows-1255"
    : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : ext === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : upstream.headers.get("content-type") ?? "application/octet-stream";
  // A readable file name (Hebrew via RFC 5987) with a plain ASCII fallback.
  const base = m.file_path.split("/").pop() ?? "file";
  const pretty = `${m.title.replace(/[\\/:*?"<>|]+/g, " ").trim()}.${ext}`;
  const headers = new Headers({
    "content-type": type,
    "content-disposition": `attachment; filename="${base}"; filename*=UTF-8''${encodeURIComponent(pretty)}`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);
  return new Response(upstream.body, { status: 200, headers });
}
