import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { netfreeSafeUrl } from "@/lib/netfree";

/**
 * Signs ONE attachment on demand and redirects to it - the document a
 * candidate uploaded as an application answer (the owner, 19/11: ״שבבחינה
 * תהיה לי תצוגה מקדימה כמו בקורות חיים״). The review center's preview drawer
 * and its download link point here, exactly like the CV files screen signs
 * CVs: nothing is pre-signed, ?download=1 asks the browser to save, and the
 * redirect lands on our own domain (Netfree blocks the storage host).
 */
export async function GET(req: Request) {
  await requireRole("admin");
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const download = url.searchParams.get("download") === "1";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("attachments")
    .select("file_path, file_name")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data, error } = await admin.storage
    .from("attachments")
    .createSignedUrl(row.file_path, 300, download ? { download: row.file_name } : undefined);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "sign failed" }, { status: 500 });
  }
  return NextResponse.redirect(new URL(netfreeSafeUrl(data.signedUrl), req.url), 302);
}
