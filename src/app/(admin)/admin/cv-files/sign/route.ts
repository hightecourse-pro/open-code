import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Signs ONE CV on demand and redirects to it. The files screen used to
 * pre-sign every document in the community on every page view — thousands of
 * signed URLs nobody clicked. ?download=1 asks the browser to save.
 */
export async function GET(req: Request) {
  await requireRole("admin");
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const download = url.searchParams.get("download") === "1";
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("cv_documents")
    .select("file_path, file_name")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data, error } = await admin.storage
    .from("cvs")
    .createSignedUrl(doc.file_path, 300, download ? { download: doc.file_name ?? "cv" } : undefined);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "sign failed" }, { status: 500 });
  }
  return NextResponse.redirect(data.signedUrl, 302);
}
