import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AlreadyAnswered, isOfficeMailConfigured, isScopeError, markOfficeMailRead, sendOfficeMailReply, syncOfficeMail } from "@/lib/office-mail";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function adminOr403() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await createAdminClient().from("profiles").select("id, role, full_name").eq("id", user.id).maybeSingle();
  return p?.role === "admin" ? p : null;
}

const ID = /^[0-9a-f]{8,32}$/i;

/**
 * תיבת המיילים ממנה (the owner, 6.11). POST with a JSON body:
 *   {action: "sync"}                 - the cron's sync, now (״לרענן מהתיבה עכשיו״; also the default without a body)
 *   {action: "read",  id}            - she opened a message here: stamp it, mark it read in the mailbox
 *   {action: "reply", id, text}      - answer in the message's thread, from office@
 * Admins only; ?id=<profile> revalidates her page.
 */
export async function POST(req: Request) {
  const me = await adminOr403();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isOfficeMailConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const url = new URL(req.url);
  const profileId = url.searchParams.get("id");
  const body = (await req.json().catch(() => ({}))) as { action?: string; id?: string; text?: string; force?: boolean };
  const action = body.action ?? "sync";
  const done = (payload: Record<string, unknown>) => {
    if (profileId && /^[0-9a-f-]{36}$/i.test(profileId)) revalidatePath(`/admin/members/${profileId}`);
    return NextResponse.json({ ok: true, ...payload }, { headers: { "cache-control": "private, no-store" } });
  };
  try {
    if (action === "sync") return done(await syncOfficeMail());
    if (!ID.test(body.id ?? "")) return NextResponse.json({ error: "id" }, { status: 400 });
    if (action === "read") return done(await markOfficeMailRead(body.id as string));
    if (action === "reply") {
      const text = (body.text ?? "").trim();
      if (text.length < 2) return NextResponse.json({ error: "empty" }, { status: 400 });
      return done(await sendOfficeMailReply({ gmailId: body.id as string, text, byId: me.id, byName: me.full_name ?? "צוות קוד פתוח", force: body.force === true }));
    }
    return NextResponse.json({ error: "action" }, { status: 400 });
  } catch (e) {
    if (e instanceof AlreadyAnswered) {
      if (profileId && /^[0-9a-f-]{36}$/i.test(profileId)) revalidatePath(`/admin/members/${profileId}`);
      return NextResponse.json({ error: "already_answered", replies: e.replies }, { status: 409 });
    }
    const msg = e instanceof Error ? e.message : "mail_failed";
    const code = isScopeError(e) ? "scope" : /drive_auth_failed|gmail_401/.test(msg) ? "not_authorized" : /^(not_found|staging_allowlist)$/.test(msg) ? msg : msg.slice(0, 160);
    return NextResponse.json({ error: code }, { status: code === "not_found" ? 404 : code === "staging_allowlist" ? 403 : 502 });
  }
}
