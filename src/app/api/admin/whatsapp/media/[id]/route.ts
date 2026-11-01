import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
// A voice note is kilobytes, a picture or a PDF a few megabytes - room for both.
export const maxDuration = 60;

/**
 * A WhatsApp thread's media (voice notes, pictures, files) for the team, fetched
 * from the private wa-media bucket at the moment of the request.
 *
 * Until 1/11 the inbox handed the browser one-hour signed storage links, made
 * when the page rendered. A thread kept open past the hour - or served again
 * from the router cache - pointed at links storage refuses, and a voice note
 * showed as a dead player at 0:00 (the owner: ״בווצאפ אני לא מצליחה לשמוע
 * הקלטה״). This route has no clock: it checks the team session and streams the
 * object, Range and all, through our own domain (Netfree blocks the storage host).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (p?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id" }, { status: 400 });
  const { data: m } = await admin.from("wa_messages").select("media_path, media_mime, filename, kind").eq("id", id).maybeSingle();
  if (!m?.media_path) return new NextResponse("not found", { status: 404 });

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const target = `${base}/storage/v1/object/wa-media/${m.media_path.split("/").map(encodeURIComponent).join("/")}`;
  const range = req.headers.get("range");
  const upstream = await fetch(target, {
    cache: "no-store",
    headers: { apikey: key, authorization: `Bearer ${key}`, ...(range ? { range } : {}) },
  });
  if (!upstream.ok && upstream.status !== 206) {
    const missing = upstream.status === 404 || upstream.status === 400;
    return new NextResponse(missing ? "not found" : "unavailable", { status: missing ? 404 : 502 });
  }

  const headers = new Headers();
  for (const h of ["content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("content-type", m.media_mime ?? upstream.headers.get("content-type") ?? "application/octet-stream");
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  const ext = m.media_path.split(".").pop() ?? "bin";
  const name = m.filename ?? (m.kind === "audio" ? `voice-note.${ext}` : (m.media_path.split("/").pop() ?? `file.${ext}`));
  const download = new URL(req.url).searchParams.get("download") === "1";
  headers.set(
    "content-disposition",
    `${download ? "attachment" : "inline"}; filename="${name.replace(/[^\w.-]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`
  );
  return new Response(upstream.body, { status: upstream.status, headers });
}
