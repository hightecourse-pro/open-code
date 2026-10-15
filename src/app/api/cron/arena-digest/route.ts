import { NextResponse } from "next/server";
import { appEnv, isProductionEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { isResendConfigured, sendResendEmail } from "@/lib/email/resend";
import { arenaDigestEmail } from "@/lib/email/templates";
import { isRestDay } from "@/lib/hebrew-calendar";
import { loadArenaMentors } from "@/lib/arena";
import { mentorScores } from "@/lib/mentor-score";
import { ARENA_ANSWER_POINTS } from "@/lib/arena-shared";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STAMP_KEY = "arena_digest_sent_on";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const qs = new URL(req.url).searchParams.get("secret");
  const hdr = req.headers.get("authorization");
  return qs === secret || hdr === `Bearer ${secret}`;
}

function israelToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

/**
 * Once a day (the owner, 15/10): "אם יש פניות שלא נענו בזירה, המנטוריות
 * (שיודעות AI) מקבלות מייל עם כותרות השאלות וסיכום נקודות שצברו". Recipients:
 * available mentors with AI experience, plus any mentor an open question was
 * addressed to. Manual: ?secret=…&dry=1 (compute only) · &all=1 (ignore the
 * once-a-day stamp) · &force=1 (also on a rest day).
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isProductionEnv() && !process.env.EMAIL_ALLOWLIST) {
    return NextResponse.json({ skipped: "not_production", env: appEnv() });
  }
  if (!isResendConfigured()) return NextResponse.json({ error: "resend_not_configured" }, { status: 500 });

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const all = url.searchParams.get("all") === "1";
  const rest = isRestDay();
  if (rest.rest && url.searchParams.get("force") !== "1") {
    return NextResponse.json({ ok: true, skipped: rest.reason, sent: 0 });
  }

  const admin = createAdminClient();
  const today = israelToday();
  if (!all && !dry) {
    const { data: stamp } = await admin.from("app_settings").select("value").eq("key", STAMP_KEY).maybeSingle();
    if ((stamp?.value as { date?: string } | null)?.date === today) {
      return NextResponse.json({ ok: true, skipped: "already_sent_today", sent: 0 });
    }
  }

  const { data: open } = await admin
    .from("arena_questions")
    .select("id, title, target_mentor_id, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(200);
  const openCount = open?.length ?? 0;
  if (openCount === 0) return NextResponse.json({ ok: true, open: 0, sent: 0, skipped: "no_open_questions" });

  const targeted = new Set((open ?? []).map((q) => q.target_mentor_id).filter((x): x is string => !!x));
  const mentors = (await loadArenaMentors()).filter((m) => (m.available && m.ai) || targeted.has(m.id));
  if (mentors.length === 0) return NextResponse.json({ ok: true, open: openCount, recipients: 0, sent: 0, skipped: "no_ai_mentors" });

  const ids = mentors.map((m) => m.id);
  const [scores, { data: emailRows }, { data: profs }] = await Promise.all([
    mentorScores(ids),
    admin.rpc("member_emails", { p_ids: ids }),
    admin.from("profiles").select("id, first_name, full_name").in("id", ids),
  ]);
  const emailOf = new Map(((emailRows ?? []) as { id: string; email: string | null }[]).map((r) => [r.id, r.email]));
  const firstOf = new Map((profs ?? []).map((p) => [p.id, p.first_name ?? p.full_name?.split(" ")[0] ?? undefined]));
  const titles = (open ?? []).slice(0, 12).map((q) => q.title);
  const arenaUrl = `${getSiteUrl()}/arena`;

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      open: openCount,
      recipients: mentors.map((m) => ({ name: m.name, ai: m.ai, targeted: targeted.has(m.id), hasEmail: !!emailOf.get(m.id) })),
      titles,
    });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const m of mentors) {
    const email = emailOf.get(m.id);
    if (!email) {
      failed++;
      continue;
    }
    const s = scores.get(m.id);
    const mail = arenaDigestEmail(firstOf.get(m.id), {
      titles,
      open: openCount,
      arenaPoints: (s?.arena ?? 0) * ARENA_ANSWER_POINTS,
      totalScore: s?.score ?? 0,
      url: arenaUrl,
    });
    const r = await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
    if (r.ok) sent++;
    else if (r.error === "blocked_by_allowlist") skipped++;
    else {
      failed++;
      console.error("[arena-digest] failed:", m.id, r.error);
    }
  }
  await admin.from("app_settings").upsert({ key: STAMP_KEY, value: { date: today, open: openCount, sent } as never }, { onConflict: "key" });
  return NextResponse.json({ ok: true, open: openCount, recipients: mentors.length, sent, skipped, failed });
}
