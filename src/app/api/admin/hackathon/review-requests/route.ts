import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { judgeAccessFor } from "@/lib/judging";
import { loadReviewRequests, REQUEST_KINDS, sendPreviewReviewRequest, sendReviewRequest, sendSampleReviewRequest, tomorrowEndOfDayIsrael, type RequestItem, type RequestKind } from "@/lib/hackathon-review-requests";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Caller {
  profile: { id: string; full_name: string } | null;
}

/** The owner (an admin who is not an appointed judge), or the cron secret - the team's own tooling sends on her behalf. */
async function callerOr403(req: Request): Promise<Caller | null> {
  const secret = process.env.CRON_SECRET;
  const hdr = req.headers.get("authorization");
  if (secret && hdr === `Bearer ${secret}`) return { profile: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await createAdminClient().from("profiles").select("id, full_name, role, status").eq("id", user.id).maybeSingle();
  if (!p || p.role !== "admin") return null;
  if ((await judgeAccessFor(p)).restricted) return null;
  return { profile: { id: p.id, full_name: p.full_name } };
}

/** The addresses a sample may go to: the team's own (active admins). */
async function adminEmails(): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin").eq("status", "active");
  const ids = (admins ?? []).map((a) => a.id);
  if (!ids.length) return new Set();
  const { data: mails } = await admin.rpc("member_emails", { p_ids: ids });
  return new Set(((mails ?? []) as { email: string | null }[]).map((m) => (m.email ?? "").toLowerCase()).filter(Boolean));
}

/**
 * בקשות השלמה (the owner, 24/10):
 * - `{action: "send", ids?: string[]}` mails every request not sent yet (or
 *   exactly the given ones, also as a resend), personally to each team member.
 * - `{action: "sample", kind, to}` mails one of the four wordings to a team
 *   member's address, so the owner reads it before anything goes to a team.
 * - `{action: "preview", to, firstName, isPair, challengeKey, items, label, dueAt}`
 *   mails one real request, as the team would get it, to a team member's
 *   address - nothing stored, nothing sent to the team.
 */
export async function POST(req: Request) {
  const caller = await callerOr403(req);
  if (!caller) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: { action?: string; ids?: unknown; kind?: unknown; to?: unknown; firstName?: unknown; isPair?: unknown; challengeKey?: unknown; items?: unknown; label?: unknown; dueAt?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body = send everything pending */
  }
  const action = body.action ?? "send";
  if (action === "sample") {
    const kind = body.kind;
    const to = String(body.to ?? "").trim().toLowerCase();
    if (!REQUEST_KINDS.includes(kind as RequestKind)) return NextResponse.json({ error: "kind" }, { status: 400 });
    if (!to || !(await adminEmails()).has(to)) return NextResponse.json({ error: "הדוגמה נשלחת רק לכתובת של חברת צוות." }, { status: 400 });
    const firstName = String(body.firstName ?? "").trim() || caller.profile?.full_name.split(/\s+/)[0] || "שרה";
    const r = await sendSampleReviewRequest(kind as RequestKind, to, firstName);
    return NextResponse.json({ ok: r.ok, error: r.error ?? null, subject: r.subject, to });
  }
  if (action === "preview") {
    const to = String(body.to ?? "").trim().toLowerCase();
    if (!to || !(await adminEmails()).has(to)) return NextResponse.json({ error: "התצוגה המקדימה נשלחת רק לכתובת של חברת צוות." }, { status: 400 });
    const items: RequestItem[] = (Array.isArray(body.items) ? body.items : [])
      .map((x) => (x && typeof x === "object" ? (x as { kind?: unknown; detail?: unknown }) : null))
      .filter((x): x is { kind: RequestKind; detail?: unknown } => !!x && REQUEST_KINDS.includes(x.kind as RequestKind))
      .map((x) => ({ kind: x.kind, detail: String(x.detail ?? "").trim().slice(0, 600) }))
      .filter((x) => x.detail);
    if (!items.length) return NextResponse.json({ error: "items" }, { status: 400 });
    const r = await sendPreviewReviewRequest({
      to,
      firstName: String(body.firstName ?? "").trim().slice(0, 40) || "שרה",
      isPair: body.isPair === true,
      challengeKey: String(body.challengeKey ?? "strauss").slice(0, 20),
      items,
      label: String(body.label ?? "").trim().slice(0, 80) || "תצוגה מקדימה",
      dueAt: typeof body.dueAt === "string" && !Number.isNaN(Date.parse(body.dueAt)) ? body.dueAt : tomorrowEndOfDayIsrael().toISOString(),
    });
    return NextResponse.json({ ok: r.ok, error: r.error ?? null, subject: r.subject, to });
  }
  if (action !== "send") return NextResponse.json({ error: "action" }, { status: 400 });
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  const all = await loadReviewRequests();
  const targets = ids.length ? all.filter((r) => ids.includes(r.id)) : all.filter((r) => !r.sentAt);
  const results = [];
  for (const r of targets) results.push(await sendReviewRequest(r.id));
  const sent = results.reduce((n, r) => n + r.sent.length, 0);
  const failed = results.filter((r) => r.sent.length === 0);
  return NextResponse.json({ ok: true, requests: results.length, sent, failed: failed.length, results });
}
