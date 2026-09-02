import { NextResponse } from "next/server";
import { appEnv } from "@/lib/env";

/**
 * The after-every-deploy check. Every silent failure this product has had was
 * a missing environment variable — no CRON_SECRET meant subscriptions never
 * expired and no digest ever sent, no NEDARIM_CALLBACK_SECRET left payments
 * leaning on a single IP, no GOOGLE_* meant Drive automation simply never
 * happened. None of those crash anything, so this endpoint reports a boolean
 * presence map (never values): a deploy isn't done until the flags that
 * matter are true and supabaseRef points at the right project.
 */
export const dynamic = "force-dynamic";

const has = (name: string) => Boolean(process.env[name]?.trim());

export async function GET(req: Request) {
  // The detail map is a reconnaissance gift to strangers (a member noticed,
  // 2/9): env-var names, project ref, commit. PUBLIC gets a bare pulse; the
  // full map answers only to the internal secret.
  const url = new URL(req.url);
  const provided = url.searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: true });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseRef = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\./)?.[1] ?? null;

  return NextResponse.json({
    appEnv: appEnv(),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    supabaseRef,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    vars: {
      NEXT_PUBLIC_SUPABASE_URL: has("NEXT_PUBLIC_SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: has("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: has("SUPABASE_SERVICE_ROLE_KEY"),
      NEXT_PUBLIC_SITE_URL: has("NEXT_PUBLIC_SITE_URL"),
      NEXT_PUBLIC_APP_ENV: has("NEXT_PUBLIC_APP_ENV"),
      AI_KEY_SECRET: has("AI_KEY_SECRET"),
      PORTAL_SESSION_SECRET: has("PORTAL_SESSION_SECRET"),
      CRON_SECRET: has("CRON_SECRET"),
      NEDARIM_MOSAD_ID: has("NEDARIM_MOSAD_ID"),
      NEDARIM_API_VALID: has("NEDARIM_API_VALID"),
      NEDARIM_CALLBACK_SECRET: has("NEDARIM_CALLBACK_SECRET"),
      RESEND_API_KEY: has("RESEND_API_KEY"),
      EMAIL_FROM: has("EMAIL_FROM"),
      EMAIL_ALLOWLIST: has("EMAIL_ALLOWLIST"),
      GOOGLE_SERVICE_ACCOUNT_EMAIL: has("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      GOOGLE_PRIVATE_KEY: has("GOOGLE_PRIVATE_KEY"),
      ALLOW_DRIVE_OUTSIDE_PRODUCTION: has("ALLOW_DRIVE_OUTSIDE_PRODUCTION"),
    },
    // The rollups an owner actually reads: money, mail, drive, cron.
    nedarimConfigured: has("NEDARIM_MOSAD_ID") && has("NEDARIM_API_VALID"),
    nedarimCallbackSecured: has("NEDARIM_CALLBACK_SECRET"),
    resendConfigured: has("RESEND_API_KEY"),
    driveConfigured: has("GOOGLE_SERVICE_ACCOUNT_EMAIL") && has("GOOGLE_PRIVATE_KEY"),
    cronConfigured: has("CRON_SECRET"),
    // The portal falls back to signing sessions with AI_KEY_SECRET when its
    // own secret is missing — it "works", which is exactly why it needs naming.
    portalSecret: has("PORTAL_SESSION_SECRET") ? "own" : "fallback",
  });
}
