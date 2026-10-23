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
  email: string | null;
  status: string;
  challengeKey: string;
  challenge: string;
  partnerId: string | null;
  partnerName: string | null;
  partnerConfirmed: boolean;
  /** Her team's submission (23/10): final, a draft, or nothing. */
  submission: "submitted" | "draft" | "none";
  submittedAt: string | null;
  productUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const fmt = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
const SUBMISSION_LABEL: Record<RegistrationRow["submission"], string> = { submitted: "הוגש", draft: "טיוטה", none: "לא הגישה" };

export function RegistrationsTable({ rows: initial, challenges }: { rows: RegistrationRow[]; challenges: { key: string; short: string }[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<string>("all");
  const [sub, setSub] = useState<"all" | "submitted" | "none">("all");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.challengeKey] = (c[r.challengeKey] ?? 0) + 1;
    return c;
  }, [rows]);
  const pairs = rows.filter((r) => r.partnerId && r.partnerConfirmed).length / 2;
  const awaiting = rows.filter((r) => r.partnerId && !r.partnerConfirmed).length;
  const submittedN = rows.filter((r) => r.submission === "submitted").length;
  const shown = rows.filter(
    (r) =>
      (filter === "all" || r.challengeKey === filter) &&
      (sub === "all" || (sub === "submitted" ? r.submission === "submitted" : r.submission !== "submitted")) &&
      (!q.trim() || r.name.includes(q.trim()) || (r.partnerName ?? "").includes(q.trim()) || (r.email ?? "").includes(q.trim()))
  );

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
    const head = ["שם", "מייל", "אתגר", "זוג עם", "סטטוס זוג", "הגשה", "הוגש ב", "קישור למוצר", "נרשמה", "עודכן"];
    const lines = shown.map((r) =>
      [
        r.name,
        r.email ?? "",
        r.challenge,
        r.partnerName ?? "",
        r.partnerId ? (r.partnerConfirmed ? "אושר" : "ממתין לאישור") : "",
        SUBMISSION_LABEL[r.submission],
        r.submittedAt ? fmt.format(new Date(r.submittedAt)) : "",
        r.productUrl ?? "",
        fmt.format(new Date(r.createdAt)),
        fmt.format(new Date(r.updatedAt)),
      ]
        .map(esc)
        .join(",")
    );
    const blob = new Blob(["﻿" + [head.map(esc).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hackathon-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3" data-testid="registrations">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-display text-base font-bold">
          🏁 רשומות ({rows.length}{pairs > 0 ? ` · ${Math.floor(pairs)} זוגות` : ""}{awaiting > 0 ? ` · ${awaiting} ממתינות לאישור זוג` : ""} · {submittedN} הגישו)
        </h2>
        <div className="relative ms-auto min-w-[200px]">
          <Search className="absolute top-1/2 -translate-y-1/2 end-3 h-4 w-4 text-ink-400" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש שם או מייל" className="pe-9" />
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={exportCsv} disabled={shown.length === 0} data-testid="registrations-export">
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
        <span className="text-ink-300">·</span>
        {(
          [
            ["all", "כולן"],
            ["submitted", `הגישו (${submittedN})`],
            ["none", `לא הגישו (${rows.length - submittedN})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSub(key)}
            data-testid={`registrations-sub-${key}`}
            className={cn("rounded-full px-3 py-1 text-[12.5px] font-semibold border", sub === key ? "bg-brand-pink-deep text-white border-brand-pink-deep" : "bg-white text-ink-700 border-ink-200")}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {shown.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-ink-200 px-4 py-6 text-center text-[13px] text-ink-500">אין רשומות שמתאימות לסינון.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-ink-50 text-ink-600 text-[12px]">
              <tr>
                <th className="text-start px-3 py-2 font-semibold">חברה</th>
                <th className="text-start px-3 py-2 font-semibold">אתגר</th>
                <th className="text-start px-3 py-2 font-semibold">זוג עם</th>
                <th className="text-start px-3 py-2 font-semibold">הגשה</th>
                <th className="text-start px-3 py-2 font-semibold">נרשמה</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.profileId} className="border-t border-ink-100" data-testid="registration-row" data-submission={r.submission}>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">
                    <Link href={`/admin/members/${r.profileId}`} target="_blank" rel="noopener" className="text-brand-purple hover:underline">
                      {r.name}
                    </Link>
                    {r.status !== "active" && <Badge className="ms-2 bg-amber-100 text-amber-800">{r.status}</Badge>}
                    {r.email && (
                      <div className="text-[11.5px] text-ink-400 font-normal" dir="ltr">
                        {r.email}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.challenge}</td>
                  <td className="px-3 py-2 text-ink-700">
                    {r.partnerId ? (
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        <Link href={`/admin/members/${r.partnerId}`} target="_blank" rel="noopener" className="hover:underline">
                          👯‍♀️ {r.partnerName ?? "-"}
                        </Link>
                        {r.partnerConfirmed ? (
                          <Badge className="bg-tint-green text-green-800">אושר ✓</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800">ממתין לאישור</Badge>
                        )}
                      </span>
                    ) : (
                      <span className="text-ink-400">לבד</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.submission === "submitted" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Badge variant="mint">הוגש{r.submittedAt ? ` ${fmt.format(new Date(r.submittedAt))}` : ""}</Badge>
                        {r.productUrl && (
                          <a href={r.productUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-brand-purple hover:underline">
                            מוצר ↗
                          </a>
                        )}
                      </span>
                    ) : r.submission === "draft" ? (
                      <Badge variant="warm">טיוטה</Badge>
                    ) : (
                      <Badge variant="gray">לא הגישה</Badge>
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
