"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveCourseAccess } from "@/app/(admin)/admin/content/actions";
import type { CourseAccessKind, ExternalAccessInput } from "@/lib/course-external";

/**
 * Admin: which kind of course (the owner, 11/10). Drive = the units and
 * links below; external = a site with a link + shared login per year cycle,
 * shown to the member with the "do not pass on" notice.
 */
export function CourseAccessEditor({ courseId, kind: initialKind, rows: initialRows }: { courseId: string; kind: CourseAccessKind; rows: ExternalAccessInput[] }) {
  const [kind, setKind] = useState<CourseAccessKind>(initialKind);
  const [rows, setRows] = useState<ExternalAccessInput[]>(initialRows.length ? initialRows : [{ label: "", url: "", username: "", password: "" }]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function setRow(i: number, patch: Partial<ExternalAccessInput>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveCourseAccess(courseId, { kind, rows: kind === "external" ? rows : [] });
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "נשמר ✓" });
    });
  }

  return (
    <div className="rounded-[12px] border border-ink-200 bg-ink-50/60 p-3 flex flex-col gap-2 mb-3">
      <div className="flex items-center gap-3 flex-wrap text-[13px]">
        <span className="font-semibold text-ink-800">סוג הגישה:</span>
        <label className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 cursor-pointer bg-white", kind === "drive" ? "border-brand-purple text-brand-purple" : "border-ink-200")}>
          <input type="radio" name={`kind-${courseId}`} checked={kind === "drive"} onChange={() => setKind("drive")} />
          Google Drive (קוביות וקישורים למטה)
        </label>
        <label className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 cursor-pointer bg-white", kind === "external" ? "border-brand-purple text-brand-purple" : "border-ink-200")}>
          <input type="radio" name={`kind-${courseId}`} checked={kind === "external"} onChange={() => setKind("external")} />
          אתר חיצוני עם קישור ופרטי כניסה
        </label>
      </div>

      {kind === "external" && (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-ink-600">
            שורה לכל מחזור/שנה: שם, קישור, שם משתמש וסיסמה. המנויה שפתחה את הקורס רואה אותם עם אזהרה בולטת שאסור להעביר הלאה. הסיסמה נשמרת מוצפנת.
          </p>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[1.2fr_2fr_1fr_1fr_auto] gap-1.5 items-center">
              <input value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} placeholder="הקלטות משנת 2025" className="text-sm border border-ink-300 rounded-md px-2.5 py-1.5 bg-white" />
              <input value={r.url} onChange={(e) => setRow(i, { url: e.target.value })} placeholder="https://…" dir="ltr" className="text-sm border border-ink-300 rounded-md px-2.5 py-1.5 bg-white" />
              <input value={r.username} onChange={(e) => setRow(i, { username: e.target.value })} placeholder="שם משתמש" dir="ltr" className="text-sm border border-ink-300 rounded-md px-2.5 py-1.5 bg-white" />
              <input value={r.password} onChange={(e) => setRow(i, { password: e.target.value })} placeholder="סיסמה" dir="ltr" className="text-sm border border-ink-300 rounded-md px-2.5 py-1.5 bg-white font-mono" />
              <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-ink-400 hover:text-danger p-1 justify-self-start" aria-label="מחיקת שורה">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setRows((rs) => [...rs, { label: "", url: "", username: "", password: "" }])} className="self-start inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-purple hover:underline">
            <Plus size={13} /> עוד שורה
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="text-[13px] font-semibold text-white bg-brand-gradient rounded-md px-4 py-1.5 disabled:opacity-60">
          {pending ? "שומרות…" : "שמירת סוג הגישה"}
        </button>
        {msg && <span className={cn("text-[12.5px] font-semibold", msg.ok ? "text-success" : "text-danger")}>{msg.text}</span>}
      </div>
    </div>
  );
}
