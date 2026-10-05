"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { adminRemoveHackathonRegistration } from "./actions";

export interface RegistrationRow {
  profileId: string;
  name: string;
  status: string;
  challengeKey: string;
  challenge: string;
  partnerId: string | null;
  partnerName: string | null;
  createdAt: string;
  updatedAt: string;
}

const fmt = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

export function RegistrationsTable({ rows: initial, challenges }: { rows: RegistrationRow[]; challenges: { key: string; short: string }[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.challengeKey] = (c[r.challengeKey] ?? 0) + 1;
    return c;
  }, [rows]);
  const pairs = rows.filter((r) => r.partnerId).length / 2;
  const shown = rows.filter((r) => (filter === "all" || r.challengeKey === filter) && (!q.trim() || r.name.includes(q.trim()) || (r.partnerName ?? "").includes(q.trim())));

  function remove(r: RegistrationRow) {
    if (!confirm(`להסיר את ההרשמה של ${r.name}?`)) return;
    setError(null);
    start(async () => {
      const res = await adminRemoveHackathonRegistration(r.profileId);
      if (res.error) return setError(res.error);
      setRows((prev) => prev.filter((x) => x.profileId !== r.profileId).map((x) => (x.partnerId === r.profileId ? { ...x, partnerId: null, partnerName: null } : x)));
    });
  }

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["שם", "אתגר", "זוג עם", "נרשמה", "עודכן"];
    const lines = shown.map((r) => [r.name, r.challenge, r.partnerName ?? "", fmt.format(new Date(r.createdAt)), fmt.format(new Date(r.updatedAt))].map(esc).join(","));
    const blob = new Blob(["﻿" + [head.map(esc).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hackathon-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-display text-base font-bold">🏁 רשומות ({rows.length}{pairs > 0 ? ` · ${Math.floor(pairs)} זוגות` : ""})</h2>
        <div className="relative ms-auto min-w-[200px]">
          <Search className="absolute top-1/2 -translate-y-1/2 end-3 h-4 w-4 text-ink-400" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש שם" className="pe-9" />
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={exportCsv} disabled={shown.length === 0}>
          ייצוא CSV ({shown.length})
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn("rounded-full px-3 py-1 text-[12.5px] font-semibold border", filter === "all" ? "bg-brand-purple text-white border-brand-purple" : "bg-white text-ink-700 border-ink-200")}
        >
          הכל ({rows.length})
        </button>
        {challenges.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={cn("rounded-full px-3 py-1 text-[12.5px] font-semibold border", filter === c.key ? "bg-brand-purple text-white border-brand-purple" : "bg-white text-ink-700 border-ink-200")}
          >
            {c.short} ({counts[c.key] ?? 0})
          </button>
        ))}
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {shown.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-ink-200 px-4 py-6 text-center text-[13px] text-ink-500">עדיין אין רשומות.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-ink-50 text-ink-600 text-[12px]">
              <tr>
                <th className="text-start px-3 py-2 font-semibold">חברה</th>
                <th className="text-start px-3 py-2 font-semibold">אתגר</th>
                <th className="text-start px-3 py-2 font-semibold">זוג עם</th>
                <th className="text-start px-3 py-2 font-semibold">נרשמה</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.profileId} className="border-t border-ink-100">
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">
                    <Link href={`/admin/members/${r.profileId}`} className="text-brand-purple hover:underline">
                      {r.name}
                    </Link>
                    {r.status !== "active" && <Badge className="ms-2 bg-amber-100 text-amber-800">{r.status}</Badge>}
                  </td>
                  <td className="px-3 py-2">{r.challenge}</td>
                  <td className="px-3 py-2 text-ink-700">
                    {r.partnerId ? (
                      <Link href={`/admin/members/${r.partnerId}`} className="hover:underline">
                        👯‍♀️ {r.partnerName ?? "-"}
                      </Link>
                    ) : (
                      <span className="text-ink-400">לבד</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-500 whitespace-nowrap">{fmt.format(new Date(r.createdAt))}</td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => remove(r)} disabled={pending} className="text-ink-400 hover:text-red-600 p-1" title="הסרת ההרשמה" aria-label="הסרת ההרשמה">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
