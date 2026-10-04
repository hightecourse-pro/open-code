"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { deleteCourseRegistration, updateCourseRegistration, type CourseRegistrationStatus } from "./actions";

export interface RegistrationRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  profile_id: string | null;
  is_subscriber: boolean;
  membership_note: string | null;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  /** Membership right now (the page computes it); the snapshot is is_subscriber. */
  subscriber_now?: boolean;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  registered: { label: "נרשמה", cls: "bg-tint-purple text-brand-purple" },
  paid: { label: "שולם ✓", cls: "bg-tint-green text-green-800" },
  canceled: { label: "בוטל", cls: "bg-ink-100 text-ink-600" },
};

const fmt = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

function csvOf(rows: RegistrationRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["שם", "מייל", "טלפון", "מנויה בהרשמה", "מנויה עכשיו", "סטטוס", "שולם ב", "הערה", "נרשמה ב"];
  const lines = rows.map((r) =>
    [
      r.full_name,
      r.email,
      r.phone ?? "",
      r.is_subscriber ? "כן" : "לא",
      r.subscriber_now ? "כן" : "לא",
      STATUS[r.status]?.label ?? r.status,
      r.paid_at ? fmt.format(new Date(r.paid_at)) : "",
      r.notes ?? "",
      fmt.format(new Date(r.created_at)),
    ]
      .map(esc)
      .join(",")
  );
  return "﻿" + [head.map(esc).join(","), ...lines].join("\r\n");
}

export function RegistrationsTable({ rows: initial }: { rows: RegistrationRow[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "subscribers" | "paid" | "open">("all");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "subscribers" && !(r.is_subscriber || r.subscriber_now)) return false;
      if (filter === "paid" && r.status !== "paid") return false;
      if (filter === "open" && r.status !== "registered") return false;
      if (!needle) return true;
      return [r.full_name, r.email, r.phone ?? "", r.notes ?? ""].some((s) => s.toLowerCase().includes(needle));
    });
  }, [rows, q, filter]);

  const counts = {
    total: rows.length,
    subscribers: rows.filter((r) => r.is_subscriber || r.subscriber_now).length,
    paid: rows.filter((r) => r.status === "paid").length,
  };

  function patch(id: string, p: { status?: CourseRegistrationStatus; notes?: string }) {
    setError(null);
    start(async () => {
      const r = await updateCourseRegistration(id, p);
      if (r.error) return setError(r.error);
      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                ...(p.status ? { status: p.status, paid_at: p.status === "paid" ? new Date().toISOString() : null } : {}),
                ...(p.notes !== undefined ? { notes: p.notes.trim() || null } : {}),
              }
            : row
        )
      );
    });
  }

  function remove(row: RegistrationRow) {
    if (!confirm(`למחוק את ההרשמה של ${row.full_name}? (לא ניתן לשחזר)`)) return;
    start(async () => {
      const r = await deleteCourseRegistration(row.id);
      if (r.error) return setError(r.error);
      setRows((prev) => prev.filter((x) => x.id !== row.id));
    });
  }

  function exportCsv() {
    const blob = new Blob([csvOf(shown)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `course-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            ["all", `הכל (${counts.total})`],
            ["subscribers", `מנויות (${counts.subscribers})`],
            ["open", `ממתינות לתשלום (${counts.total - counts.paid - rows.filter((r) => r.status === "canceled").length})`],
            ["paid", `שולם (${counts.paid})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={cn(
              "rounded-full px-3 py-1 text-[12.5px] font-semibold border transition-colors",
              filter === k ? "bg-brand-purple text-white border-brand-purple" : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
            )}
          >
            {label}
          </button>
        ))}
        <div className="relative ms-auto min-w-[220px]">
          <Search className="absolute top-1/2 -translate-y-1/2 end-3 h-4 w-4 text-ink-400" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש שם / מייל / טלפון" className="pe-9" />
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={exportCsv} disabled={shown.length === 0}>
          ייצוא CSV ({shown.length})
        </Button>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      {shown.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-[13.5px] text-ink-500">
          {rows.length === 0 ? "עדיין אין נרשמות. ברגע שמישהי תירשם בדף הציבורי היא תופיע כאן." : "אין תוצאות לסינון הזה."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[16px] border border-ink-100 bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-ink-50 text-ink-600 text-[12px]">
              <tr>
                <th className="text-start px-3 py-2 font-semibold">שם</th>
                <th className="text-start px-3 py-2 font-semibold">פרטי קשר</th>
                <th className="text-start px-3 py-2 font-semibold">מנויה</th>
                <th className="text-start px-3 py-2 font-semibold">סטטוס</th>
                <th className="text-start px-3 py-2 font-semibold">הערה</th>
                <th className="text-start px-3 py-2 font-semibold">נרשמה</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-ink-100 align-top">
                  <td className="px-3 py-2 font-semibold text-ink-1000 whitespace-nowrap">
                    {r.profile_id ? (
                      <Link href={`/admin/members/${r.profile_id}`} className="text-brand-purple hover:underline">
                        {r.full_name}
                      </Link>
                    ) : (
                      r.full_name
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-700">
                    <div dir="ltr" className="text-start">
                      {r.email}
                    </div>
                    <div dir="ltr" className="text-start text-ink-500">
                      {r.phone}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {r.subscriber_now || r.is_subscriber ? (
                      <Badge className="bg-tint-green text-green-800">מנויה ✓</Badge>
                    ) : (
                      <Badge className="bg-ink-100 text-ink-600">לא מנויה</Badge>
                    )}
                    {r.is_subscriber !== !!r.subscriber_now && (
                      <div className="text-[11px] text-amber-700 mt-1">
                        {r.subscriber_now ? "הצטרפה אחרי ההרשמה" : "היתה מנויה בהרשמה - המנוי לא פעיל עכשיו"}
                      </div>
                    )}
                    {r.membership_note && <div className="text-[11px] text-ink-500 mt-1 max-w-[220px]">{r.membership_note}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.status}
                      disabled={pending}
                      onChange={(e) => patch(r.id, { status: e.target.value as CourseRegistrationStatus })}
                      className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold border-0", STATUS[r.status]?.cls ?? "bg-ink-100")}
                    >
                      {Object.entries(STATUS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    {r.paid_at && <div className="text-[11px] text-ink-500 mt-1">{fmt.format(new Date(r.paid_at))}</div>}
                  </td>
                  <td className="px-3 py-2 min-w-[180px]">
                    <NoteCell value={r.notes ?? ""} onSave={(v) => patch(r.id, { notes: v })} />
                  </td>
                  <td className="px-3 py-2 text-ink-500 whitespace-nowrap">{fmt.format(new Date(r.created_at))}</td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      className="text-ink-400 hover:text-red-600 p-1"
                      title="מחיקת ההרשמה"
                      aria-label="מחיקת ההרשמה"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NoteCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <textarea
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v.trim() !== value.trim()) onSave(v);
      }}
      rows={2}
      placeholder="הערה פנימית…"
      className="w-full rounded-[10px] border border-ink-200 px-2 py-1 text-[12.5px] focus:border-brand-purple outline-none"
    />
  );
}
