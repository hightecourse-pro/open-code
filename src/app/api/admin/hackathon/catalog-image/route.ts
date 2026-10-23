import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { judgeAccessFor } from "@/lib/judging";
import { ensureCatalogFolder, uploadCatalogImage } from "@/lib/hackathon-drive";
import { downloadDriveFile } from "@/lib/drive-api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** The owner only - an admin who is not an appointed judge. */
async function ownerOr403() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await createAdminClient().from("profiles").select("id, role, status").eq("id", user.id).maybeSingle();
  if (!p || p.role !== "admin") return null;
  return (await judgeAccessFor(p)).restricted ? null : p;
}

/** A mirrored video's bytes (?id=<drive file id>) - the catalogue picks a frame out of it when no screen is usable. */
export async function GET(req: Request) {
  if (!(await ownerOr403())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[\w-]{10,}$/.test(id)) return NextResponse.json({ error: "id" }, { status: 400 });
  try {
    const res = await downloadDriveFile(id);
    const headers = new Headers();
    headers.set("content-type", res.headers.get("content-type") ?? "application/octet-stream");
    const len = res.headers.get("content-length");
    if (len) headers.set("content-length", len);
    headers.set("cache-control", "private, no-store");
    return new Response(res.body, { status: 200, headers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "download_failed" }, { status: 500 });
  }
}

/**
 * One catalogue picture for one project (the owner, 23/10): multipart with
 * `team_key`, `name` (the file name - the submitters), optional `caption`,
 * optional `parent` (a shared-drive id; default = the configured Drive target)
 * and `file` (JPEG/PNG). Uploads into the "קטלוג הפרויקטים" folder of the
 * shared drive and links the Drive id on the submission when it exists here.
 */
export async function POST(req: Request) {
  if (!(await ownerOr403())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart expected" }, { status: 400 });
  }
  const teamKey = String(form.get("team_key") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim() || null;
  const parent = String(form.get("parent") ?? "").trim() || null;
  const file = form.get("file");
  if (!teamKey || !name || !(file instanceof File) || file.size === 0) return NextResponse.json({ error: "team_key, name and file are required" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "file too large" }, { status: 400 });
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  try {
    const folder = await ensureCatalogFolder(parent);
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileId = await uploadCatalogImage(folder.id, `${name}.${mime === "image/png" ? "png" : "jpg"}`, mime, bytes);
    const admin = createAdminClient();
    const { data: sub } = await admin.from("hackathon_submissions").select("team_key").eq("team_key", teamKey).maybeSingle();
    if (sub) await admin.from("hackathon_submissions").update({ catalog_image_drive_id: fileId, catalog_image_caption: caption }).eq("team_key", teamKey);
    return NextResponse.json({ ok: true, fileId, folderId: folder.id, linked: !!sub });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "upload_failed" }, { status: 500 });
  }
}
