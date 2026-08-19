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
