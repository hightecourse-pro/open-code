import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The task-trigger mechanism (the owner, 3/9): system events fire named
 * triggers; a task_rules row decides whether that event opens a task and
 * which team member always receives it. Rules are seeded DISABLED — the
 * owner enables and routes each one from /admin/tasks.
 *
 * Fire-and-forget by contract: a trigger must never break the flow that
 * fired it (a failed task insert on a payment webhook would be absurd).
 */
export async function fireTaskTrigger(
  key: string,
  task: { title: string; details?: string; link?: string }
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: rule } = await admin
      .from("task_rules")
      .select("assignee_id, enabled")
      .eq("key", key)
      .maybeSingle();
    if (!rule?.enabled || !rule.assignee_id) return;
    await admin.from("admin_tasks").insert({
      title: task.title,
      details: task.details ?? null,
      link: task.link ?? null,
      assignee_id: rule.assignee_id,
      source: "trigger",
      trigger_key: key,
    });
  } catch (e) {
    console.error("[tasks] trigger failed:", key, e);
  }
}
