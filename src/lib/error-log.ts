import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The last errors, kept where the team can read them (the owner, 26/10: "כל
 * הזמן אני מקבלת שגיאות" - and the sad screen says nothing about why). A
 * server page wraps its body in `guarded`; the client boundary posts what it
 * caught to /api/errors. Both land in one app_settings row - a ring of the
 * last sixty - and /admin/errors lists them. No table, no migration.
 */
const KEY = "error_log";
const KEEP = 60;

export interface AppErrorItem {
  at: string;
  kind: "server" | "client";
  where: string;
  message: string;
  stack: string | null;
  digest: string | null;
  profileId: string | null;
}

export async function recordAppError(item: Omit<AppErrorItem, "at">): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("app_settings").select("value").eq("key", KEY).maybeSingle();
    const prev = Array.isArray((data?.value as { items?: unknown } | null)?.items) ? ((data!.value as { items: AppErrorItem[] }).items ?? []) : [];
    const next: AppErrorItem[] = [
      {
        at: new Date().toISOString(),
        kind: item.kind,
        where: item.where.slice(0, 300),
        message: (item.message || "(no message)").slice(0, 1000),
        stack: item.stack ? item.stack.slice(0, 4000) : null,
        digest: item.digest ? item.digest.slice(0, 100) : null,
        profileId: item.profileId,
      },
      ...prev,
    ].slice(0, KEEP);
    await admin.from("app_settings").upsert({ key: KEY, value: { items: next } }, { onConflict: "key" });
  } catch (e) {
    console.error("[error-log] could not record:", e instanceof Error ? e.message : e);
  }
}

export async function readAppErrors(): Promise<AppErrorItem[]> {
  try {
    const { data } = await createAdminClient().from("app_settings").select("value").eq("key", KEY).maybeSingle();
    const items = (data?.value as { items?: unknown } | null)?.items;
    return Array.isArray(items) ? (items as AppErrorItem[]) : [];
  } catch {
    return [];
  }
}

/** Next's own control-flow throws (redirect, notFound) are not errors. */
function isNextControlFlow(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

/** Who is signed in - looked up only once something crashed, so the happy path pays nothing. */
async function viewerId(): Promise<string | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/** Run a page body; a crash is recorded with its real message and stack, then rethrown so the boundary still shows. */
export async function guarded<T>(where: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isNextControlFlow(e)) {
      const err = e as { message?: unknown; stack?: unknown; digest?: unknown };
      await recordAppError({
        kind: "server",
        where,
        message: typeof err?.message === "string" ? err.message : String(e),
        stack: typeof err?.stack === "string" ? err.stack : null,
        digest: typeof err?.digest === "string" ? err.digest : null,
        profileId: await viewerId(),
      });
    }
    throw e;
  }
}
