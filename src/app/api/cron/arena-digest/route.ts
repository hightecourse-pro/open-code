import { NextResponse } from "next/server";
import { appEnv, isProductionEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { isResendConfigured } from "@/lib/email/resend";
import { isRestDay } from "@/lib/hebrew-calendar";
import { runArenaDigest } from "@/lib/arena-digest";

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
function israelWeekday(): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "short" }).format(new Date());
}

/**
 * Once a day (the owner, 15/10): open arena questions to the mentors who
 * know AI, with their points. On Sundays (16/10): the weekly leaderboard to
 * every active mentor. Manual: ?secret=…&dry=1 · &all=1 (ignore the stamp) ·
 * &force=1 (also on a rest day) · &weekly=1 (the weekly mail now).
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
  const weekly = url.searchParams.get("weekly") === "1" || israelWeekday() === "Sun";
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
  const result = await runArenaDigest({ dry, weekly });
  if (!dry && (result.open > 0 || weekly)) {
    await admin.from("app_settings").upsert({ key: STAMP_KEY, value: { date: today, open: result.open, sent: result.sent, weekly } as never }, { onConflict: "key" });
  }
  return NextResponse.json({ ...result, dry, skipped: result.open === 0 && !weekly ? "no_open_questions" : result.recipients === 0 ? "no_recipients" : result.skipped });
}
