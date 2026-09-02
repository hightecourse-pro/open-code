"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ExternalLink, Zap } from "lucide-react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";
import { addTask, deleteTask, setTaskDone, updateTaskRule, type TaskFormState } from "./tasks-actions";

export interface TaskRow {
  id: string;
  title: string;
  details: string | null;
  link: string | null;
  assignee_id: string | null;
  status: string;
  source: string;
  trigger_key: string | null;
  created_at: string;
  done_at: string | null;
}

export interface TeamMember {
  id: string;
  full_name: string;
}

export interface RuleRow {
  key: string;
  label: string;
  assignee_id: string | null;
  enabled: boolean;
}

export function TasksBoard({
  tasks,
  team,
  rules,
  meId,
}: {
  tasks: TaskRow[];
  team: TeamMember[];
  rules: RuleRow[];
  meId: string;
}) {
  const [addState, add, adding] = useActionState<TaskFormState, TaskFormData>(addTask, {});
  const [showAdd, setShowAdd] = useState(false);
  const [, start] = useTransition();
  const teamName = useMemo(() => new Map(team.map((t) => [t.id, t.full_name])), [team]);

  // Fixed per-team-member filter (the owner, 3/9: "סינון קבוע למשימות של כל
  // אחת מהצוות") — defaults to the viewer's own tasks.
  const [who, setWho] = useState<string>(meId);
  const [statusFilter, setStatusFilter] = useState<"open" | "done" | "all">("open");

  const filtered = tasks.filter(
    (t) =>
      (who === "all" || t.assignee_id === who) &&
      (statusFilter === "all" || t.status === statusFilter)
  );
  const openCountBy = (id: string) => tasks.filter((t) => t.assignee_id === id && t.status === "open").length;
  const totalOpen = tasks.filter((t) => t.status === "open").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Team-member chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setWho("all")}
          className={cn(
            "text-[12.5px] font-semibold px-3 py-1.5 rounded-full border transition-colors",
            who === "all"
              ? "bg-brand-gradient text-white border-transparent"
              : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
          )}
        >
          כל הצוות · {totalOpen}
        </button>
        {team.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setWho(t.id)}
            className={cn(
              "text-[12.5px] font-semibold px-3 py-1.5 rounded-full border transition-colors",
              who === t.id
                ? "bg-brand-gradient text-white border-transparent"
                : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
            )}
          >
            {t.full_name}
            {t.id === meId ? " (אני)" : ""} · {openCountBy(t.id)}
          </button>
        ))}
        <div className="ms-auto flex gap-1.5">
          {(["open", "done", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "text-[12px] px-2.5 py-1 rounded-full border",
                statusFilter === s
                  ? "bg-ink-900 text-white border-transparent"
                  : "bg-white text-ink-500 border-ink-200"
              )}
            >
              {s === "open" ? "פתוחות" : s === "done" ? "הושלמו" : "הכל"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex">
        <Button type="button" size="sm" variant={showAdd ? "secondary" : "primary"} onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "סגירה" : "+ משימה חדשה"}
        </Button>
      </div>

      {showAdd && (
        <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
          {addState.error && <Alert variant="danger">{addState.error}</Alert>}
          {addState.ok && <Alert variant="success">נשמרה ✓</Alert>}
          <form action={add} className="flex flex-col gap-3">
            <div className="flex items-end gap-2 flex-wrap">
              <Field label="המשימה" htmlFor="t_title" className="w-72 max-w-full">
                <Input id="t_title" name="title" required placeholder="מה צריך לעשות?" />
              </Field>
              <Field label="למי" htmlFor="t_assignee" className="w-48 max-w-full">
                <select
                  id="t_assignee"
                  name="assignee_id"
                  defaultValue={meId}
                  className="w-full h-10 border border-ink-300 rounded-md px-2.5 text-sm bg-white"
                >
                  {team.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="קישור (אופציונלי)" htmlFor="t_link" className="w-64 max-w-full">
                <Input id="t_link" name="link" dir="ltr" placeholder="/admin/…" />
              </Field>
            </div>
            <Field label="פרטים (אופציונלי)" htmlFor="t_details">
              <Textarea id="t_details" name="details" rows={2} />
            </Field>
            <Button type="submit" size="sm" className="w-fit" disabled={adding}>
              {adding ? "שומרות…" : "שמירה"}
            </Button>
          </form>
        </div>
      )}

      {/* Task list */}
      <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm divide-y divide-ink-100">
        {filtered.map((t) => (
          <div key={t.id} className={cn("flex items-start gap-3 px-4 py-3", t.status === "done" && "opacity-55")}>
            <button
              type="button"
              onClick={() => start(() => void setTaskDone(t.id, t.status !== "done"))}
              aria-label={t.status === "done" ? "החזרה לפתוחות" : "סימון כהושלמה"}
              className={cn(
                "mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                t.status === "done"
                  ? "bg-success border-success text-white"
                  : "border-ink-300 hover:border-brand-purple"
              )}
            >
              {t.status === "done" && <Check size={13} />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("font-semibold text-[14px] text-ink-900", t.status === "done" && "line-through")}>
                  {t.title}
                </span>
                {t.source === "trigger" && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-tint-purple text-brand-purple px-1.5 py-0.5 rounded-full">
                    <Zap size={9} /> אוטומטית
                  </span>
                )}
                {t.link && (
                  <Link href={t.link} className="inline-flex items-center gap-0.5 text-[11.5px] text-brand-purple hover:underline">
                    <ExternalLink size={11} /> פתיחה
                  </Link>
                )}
              </div>
              {t.details && <p className="text-[12.5px] text-ink-700 mt-0.5 whitespace-pre-line">{t.details}</p>}
              <div className="text-[11px] text-ink-400 mt-0.5">
                {t.assignee_id ? (teamName.get(t.assignee_id) ?? "חברת צוות") : "ללא שיוך"} · {timeAgo(t.created_at)}
                {t.done_at && ` · הושלמה ${timeAgo(t.done_at)}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm("למחוק את המשימה?")) start(() => void deleteTask(t.id));
              }}
              className="text-[11px] text-ink-300 hover:text-danger underline shrink-0"
            >
              מחיקה
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-ink-500 text-[13px]">
            אין משימות בסינון הזה 🎈
          </div>
        )}
      </div>

      {/* Trigger routing rules */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
        <h3 className="font-display text-base font-bold">⚡ חוקי ניתוב אוטומטיים</h3>
        <p className="text-[12.5px] text-ink-500">
          כל שורה היא אירוע במערכת. כשהחוק דולק — האירוע פותח משימה אוטומטית לחברת הצוות שנבחרה.
        </p>
        <div className="flex flex-col divide-y divide-ink-100">
          {rules.map((r) => (
            <RuleLine key={r.key} rule={r} team={team} />
          ))}
        </div>
      </div>
    </div>
  );
}

type TaskFormData = FormData;

function RuleLine({ rule, team }: { rule: RuleRow; team: TeamMember[] }) {
  const [assignee, setAssignee] = useState(rule.assignee_id ?? "");
  const [enabled, setEnabled] = useState(rule.enabled);
  const [, start] = useTransition();

  function save(nextAssignee: string, nextEnabled: boolean) {
    start(() => void updateTaskRule(rule.key, nextAssignee || null, nextEnabled && !!nextAssignee));
  }

  return (
    <div className="flex items-center gap-3 py-2.5 flex-wrap">
      <span className="font-semibold text-[13.5px] text-ink-900 w-56">{rule.label}</span>
      <select
        value={assignee}
        onChange={(e) => {
          setAssignee(e.target.value);
          save(e.target.value, enabled);
        }}
        className="h-8 border border-ink-200 rounded-md px-2 text-[12.5px] bg-white"
      >
        <option value="">— בחרי חברת צוות —</option>
        {team.map((t) => (
          <option key={t.id} value={t.id}>
            {t.full_name}
          </option>
        ))}
      </select>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => {
          const next = !enabled;
          setEnabled(next);
          save(assignee, next);
        }}
        className={cn(
          "relative w-10 h-[22px] rounded-full transition-colors",
          enabled && assignee ? "bg-brand-purple" : "bg-ink-200"
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all",
            enabled && assignee ? "start-[22px]" : "start-[3px]"
          )}
        />
      </button>
      <span className="text-[11.5px] text-ink-400">
        {enabled && assignee ? "דולק — פותח משימות" : "כבוי"}
      </span>
    </div>
  );
}
