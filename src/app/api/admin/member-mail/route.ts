import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOfficeMailConfigured, syncOfficeMail } from "@/lib/office-mail";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function adminOr403() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await createAdminClient().from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  return p?.role === "admin" ? p : null;
}

/** ״לרענן מהתיבה עכשיו״ (the owner, 6.11): the same sync the cron runs every four hours, now. Admins only. */
export async function POST(req: Request) {
  if (!(await adminOr403())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isOfficeMailConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  try {
    const r = await syncOfficeMail();
    const id = new URL(req.url).searchParams.get("id");
    if (id && /^[0-9a-f-]{36}$/i.test(id)) revalidatePath(`/admin/members/${id}`);
    return NextResponse.json({ ok: true, ...r }, { headers: { "cache-control": "private, no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "mail_failed";
    return NextResponse.json({ error: /drive_auth_failed|gmail_40[13]/.test(msg) ? "not_authorized" : msg.slice(0, 160) }, { status: 502 });
  }
}
