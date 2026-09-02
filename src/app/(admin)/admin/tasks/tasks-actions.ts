"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type TaskFormState = { error?: string; ok?: boolean };

export async function addTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const me = await requireRole("admin");
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  if (!title) return { error: "כתבי מה המשימה." };
  const details = String(formData.get("details") ?? "").trim().slice(0, 2000) || null;
  const assignee = String(formData.get("assignee_id") ?? "").trim() || null;
  const link = String(formData.get("link") ?? "").trim().slice(0, 300) || null;

  const supabase = await createClient();
  const { error } = await supabase.from("admin_tasks").insert({
    title,
    details,
    link,
    assignee_id: assignee,
    source: "manual",
    created_by: me.id,
  });
  if (error) return { error: "לא הצלחנו לשמור. נסי שוב." };
  revalidatePath("/admin/tasks");
  return { ok: true };
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const me = await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("admin_tasks")
    .update(
      done
        ? { status: "done", done_at: new Date().toISOString(), done_by: me.id }
        : { status: "open", done_at: null, done_by: null }
    )
    .eq("id", id);
  revalidatePath("/admin/tasks");
}

export async function deleteTask(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("admin_tasks").delete().eq("id", id);
  revalidatePath("/admin/tasks");
}

/** Route a trigger type to a team member / turn it on or off. */
export async function updateTaskRule(
  key: string,
  assigneeId: string | null,
  enabled: boolean
): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("task_rules")
    .update({ assignee_id: assigneeId, enabled, updated_at: new Date().toISOString() })
    .eq("key", key);
  revalidatePath("/admin/tasks");
}
