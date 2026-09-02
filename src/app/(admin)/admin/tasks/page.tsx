import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { TasksBoard, type TaskRow, type TeamMember, type RuleRow } from "./tasks-board";

export const metadata: Metadata = { title: "משימות" };
export const dynamic = "force-dynamic";

/**
 * משימות (the owner, 3/9): the team's shared task list with a fixed filter
 * per team member, plus the trigger-routing rules — which system events open
 * a task and who always receives it.
 */
export default async function AdminTasksPage() {
  const me = await requireRole("admin");
  const supabase = await createClient();

  const [{ data: tasks }, { data: team }, { data: rules }] = await Promise.all([
    supabase
      .from("admin_tasks")
      .select("id, title, details, link, assignee_id, status, source, trigger_key, created_at, done_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "admin")
      .order("full_name"),
    supabase.from("task_rules").select("key, label, assignee_id, enabled").order("label"),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;משימות/&gt;</span>
        <h1 className="font-display text-[26px] font-black text-ink-1000 mt-1">משימות</h1>
        <p className="t-body-sm text-ink-700">
          המשימות של הצוות — ידניות ואוטומטיות. למטה: חוקי הניתוב שקובעים אילו אירועים במערכת
          פותחים משימה ולמי היא מנותבת.
        </p>
      </div>

      <TasksBoard
        tasks={(tasks ?? []) as TaskRow[]}
        team={(team ?? []) as TeamMember[]}
        rules={(rules ?? []) as RuleRow[]}
        meId={me.id}
      />
    </div>
  );
}
