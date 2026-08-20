import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The alerts center's single write door. Called from webhooks and crons with
 * the service role — never from a browser (the table has no insert policy).
 *
 * A dedupeKey collapses repeats: the same event again bumps `count`, refreshes
 * `last_seen_at`, and re-surfaces the row as unread — so a probe storm is one
 * loud row, not a thousand quiet ones.
 *
 * Never throws: an alert about a failure must not break the flow that failed.
 */
export interface RaiseAlertInput {
  kind: string;
  severity: "critical" | "warning" | "info";
  title: string;
  body?: string;
  context?: unknown;
  dedupeKey?: string;
}

export async function raiseAlert(input: RaiseAlertInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const row = {
      kind: input.kind,
      severity: input.severity,
      title: input.title,
      body: input.body ?? null,
      context: (input.context ?? null) as never,
    };

    if (input.dedupeKey) {
      const { data: existing } = await admin
        .from("admin_alerts")
        .select("id, count")
        .eq("dedupe_key", input.dedupeKey)
        .maybeSingle();
      if (existing) {
        await admin
          .from("admin_alerts")
          .update({
            ...row,
            count: existing.count + 1,
            last_seen_at: new Date().toISOString(),
            read_at: null, // it happened again — it is news again
          })
          .eq("id", existing.id);
        return;
      }
      await admin.from("admin_alerts").insert({ ...row, dedupe_key: input.dedupeKey });
      return;
    }

    await admin.from("admin_alerts").insert(row);
  } catch (e) {
    console.error("[alerts] raise failed:", input.kind, e);
  }
}

/** The sidebar badge — one head-only count. */
export async function unreadAlertCount(): Promise<number> {
  try {
    const { count } = await createAdminClient()
      .from("admin_alerts")
      .select("*", { count: "exact", head: true })
      .is("read_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}
