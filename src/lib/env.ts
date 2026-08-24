/**
 * Which environment is this deployment?
 *
 * NODE_ENV cannot answer it — both staging and production are production
 * builds. NEXT_PUBLIC_APP_ENV is set per Vercel project ("staging" on the
 * project serving open-code-psi.vercel.app, "production" on the one serving
 * app.opencode.org.il) and is inlined at build time.
 *
 * FAIL CLOSED: a production build with the variable missing reports
 * "staging", because everything that keys off this gate blocks real-world
 * side effects outside production — real email, Drive grants and revokes,
 * cron sweeps. A misconfigured deployment must end up inert, not armed.
 */

export type AppEnv = "production" | "staging" | "development";

export function appEnv(): AppEnv {
  const v = process.env.NEXT_PUBLIC_APP_ENV;
  if (v === "production" || v === "staging") return v;
  return process.env.NODE_ENV === "production" ? "staging" : "development";
}

export function isProductionEnv(): boolean {
  return appEnv() === "production";
}

/**
 * May this environment perform REAL Google Drive grants/revokes?
 *
 * The service account and the course folders are shared between environments
 * (owner decision), so outside production this is normally read-only: clicks
 * queue rows, nothing reaches Google. The owner's 2026-08-24 call — testers
 * aren't community members, she accepts the risk — turns staging on via an
 * explicit env flag rather than by deleting the gate: a fresh environment or
 * a dev machine stays safe by default.
 */
export function driveAutomationAllowed(): boolean {
  return isProductionEnv() || process.env.ALLOW_DRIVE_OUTSIDE_PRODUCTION === "1";
}
