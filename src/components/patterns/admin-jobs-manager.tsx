"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Download, ExternalLink, Plus, Search, Trash2, X } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { bulkJobs, deleteJob } from "@/app/(admin)/admin/actions";
import { ConfirmActionButton } from "./confirm-action-button";
import { AdminCreateJob } from "./admin-create-job";
import {
  AdminJobRow,
  appsLabel,
  daysOpen,
  type AdminJob,
  type JobAppCounts,
  type PortalClientOption,
} from "./admin-job-row";

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/** The lifecycle stage a job files under (the PM's grouping). */
type Stage = "draft" | "active" | "process" | "done";
function stageOf(j: AdminJob): Stage {
  if (j.pipeline_status === "hired" || j.pipeline_status === "closed_no_hire") return "done";
  if (j.status === "closed" && j.pipeline_status !== "draft") return "done";
  if (j.pipeline_status === "draft") return "draft";
  if (j.pipeline_status === "candidates_sent" || j.pipeline_status === "interviews") return "process";
  return "active";
}

const STAGES: { key: Stage; title: string; openByDefault: boolean }[] = [
  { key: "active", title: "פעילות", openByDefault: true },
  { key: "process", title: "בתהליך מול לקוח", openByDefault: true },
  { key: "draft", title: "טיוטות", openByDefault: false },
  { key: "done", title: "הסתיימו", openByDefault: false },
];

/** Client-side CSV download (UTF-8 BOM so Excel opens Hebrew correctly). */
function exportCsv(filename: string, header: string[], rows: string[][]) {
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

type SortKey = "title" | "company" | "location" | "date";

export function AdminJobsManager({
  jobs,
  clients,
  appCounts,
  initialClientId,
  created,
}: {
  jobs: AdminJob[];
  clients: PortalClientOption[];
  appCounts?: Record<string, JobAppCounts>;
  initialClientId?: string;
  created?: boolean;
}) {
  const [tab, setTab] = useState<"ours" | "open">("ours");
  const [formOpen, setFormOpen] = useState(Boolean(initialClientId));
  const [q, setQ] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<Stage, boolean>>(
    Object.fromEntries(STAGES.map((s) => [s.key, s.openByDefault])) as Record<Stage, boolean>
  );
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [, startBulk] = useTransition();

  const needle = q.trim().toLowerCase();
  const match = (j: AdminJob) =>
    !needle || j.title.toLowerCase().includes(needle) || j.company.toLowerCase().includes(needle);

  // ── ours: grouped by stage, newest first inside each group ────────────────
  const ours = useMemo(
    () =>
      jobs
        .filter((j) => j.source === "ours" && match(j))
        .sort((a, b) => (b.published_at ?? b.created_at ?? "").localeCompare(a.published_at ?? a.created_at ?? "")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobs, needle]
  );
  const byStage = useMemo(() => {
    const m = new Map<Stage, AdminJob[]>();
    for (const j of ours) {
      const s = stageOf(j);
      m.set(s, [...(m.get(s) ?? []), j]);
    }
    return m;
  }, [ours]);

  // ── market: a flat sortable table ─────────────────────────────────────────
  const market = useMemo(() => {
    const rows = jobs.filter((j) => j.source === "open" && match(j));
    const val = (j: AdminJob): string => {
      switch (sort.key) {
        case "title":
          return j.title;
        case "company":
          return j.company;
        case "location":
          return j.location ?? "";
        case "date":
          return j.published_at ?? j.created_at ?? "";
      }
    };
    return rows.sort((a, b) => sort.dir * val(a).localeCompare(val(b), "he"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, needle, sort]);

  const oursCount = jobs.filter((j) => j.source === "ours").length;
  const marketCount = jobs.filter((j) => j.source === "open").length;

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "date" ? -1 : 1 }));
  }

  function runBulk(op: "close" | "open" | "delete") {
    const ids = [...selection];
    if (op === "delete" && !window.confirm(`למחוק ${ids.length} משרות לצמיתות? הפעולה אינה ניתנת לביטול.`)) return;
    setSelection(new Set());
    startBulk(() => void bulkJobs(ids, op));
  }

  function exportOurs() {
    exportCsv(
      "jobs-ours.csv",
      ["משרה", "לקוח/חברה", "מיקום", "שלב", "סטטוס", "פורסמה", "ימים פתוחה", "הגשות", "חדשות"],
      ours.map((j) => [
        j.title,
        j.company,
        j.location ?? "",
        stageOf(j),
        j.pipeline_status,
        j.published_at ? DATE_HE.format(new Date(j.published_at)) : "",
        String(daysOpen(j) ?? ""),
        String(appCounts?.[j.id]?.total ?? 0),
        String(appCounts?.[j.id]?.newCount ?? 0),
      ])
    );
  }

  function exportMarket() {
    exportCsv(
      "jobs-market.csv",
      ["משרה", "חברה", "מיקום", "מקור", "תאריך פרסום", "קישור"],
      market.map((j) => [
        j.title,
        j.company,
        j.location ?? "",
        sourceHost(j.external_url),
        DATE_HE.format(new Date(j.published_at ?? j.created_at ?? Date.now())),
        j.external_url ?? "",
      ])
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {created && <Alert variant="success">המשרה נוספה ✓ הנה היא ברשימה.</Alert>}

      {/* Tabs — two different worlds, two different tables (the PM's call). */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { key: "ours", label: `שלנו (${oursCount})` },
            { key: "open", label: `שוק (${marketCount})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-semibold border transition-colors cursor-pointer",
              tab === t.key
                ? "bg-ink-1000 text-white border-transparent"
                : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="relative flex-1 min-w-48">
          <Search size={14} aria-hidden className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-400 pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי תפקיד או חברה…"
            className="ps-9"
            aria-label="חיפוש משרות"
          />
        </div>
        <button
          type="button"
          onClick={tab === "ours" ? exportOurs : exportMarket}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white text-ink-700 text-[13px] font-semibold px-3.5 py-2 hover:border-brand-purple cursor-pointer"
          title="ייצוא הרשימה לאקסל (CSV)"
        >
          <Download size={14} /> אקסל
        </button>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-white text-[13px] font-semibold px-4 py-2 hover:brightness-105 transition-[filter] cursor-pointer"
        >
          {formOpen ? <X size={15} /> : <Plus size={15} />}
          {formOpen ? "סגירה" : "משרה חדשה"}
        </button>
      </div>

      {formOpen && (
        <div className="rounded-md border border-brand-purple/25 bg-tint-purple/20 p-4 bg-white">
          <AdminCreateJob clients={clients} initialClientId={initialClientId} />
        </div>
      )}

      {/* bulk bar (ours) */}
      {tab === "ours" && selection.size > 0 && (
        <div className="sticky top-2 z-20 flex items-center gap-2 rounded-[14px] border border-brand-purple/40 bg-tint-purple p-3 shadow-sm flex-wrap">
          <span className="text-[12.5px] font-bold text-brand-purple">{selection.size} נבחרו</span>
          <Button size="sm" variant="secondary" onClick={() => runBulk("close")}>סגירת המשרות</Button>
          <Button size="sm" variant="secondary" onClick={() => runBulk("open")}>פתיחה מחדש</Button>
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => runBulk("delete")}>מחיקה…</Button>
          <button type="button" className="ms-auto text-[12px] text-ink-500 underline cursor-pointer" onClick={() => setSelection(new Set())}>
            ניקוי הבחירה
          </button>
        </div>
      )}

      {tab === "ours" ? (
        <div className="flex flex-col gap-3">
          {STAGES.map(({ key, title }) => {
            const group = byStage.get(key) ?? [];
            if (group.length === 0) return null;
            const fresh = group.reduce((n, j) => n + (appCounts?.[j.id]?.newCount ?? 0), 0);
            const total = group.reduce((n, j) => n + (appCounts?.[j.id]?.total ?? 0), 0);
            const open = openGroups[key];
            return (
              <div key={key} className="bg-white border border-ink-200 rounded-[18px] p-4 shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenGroups((g) => ({ ...g, [key]: !g[key] }))}
                  className="w-full flex items-center gap-2 font-display text-[15px] font-bold text-ink-1000 cursor-pointer"
                >
                  <ChevronDown size={16} className={cn("transition-transform", !open && "-rotate-90")} />
                  {title} ({group.length})
                  {fresh > 0 && (
                    <span className="rounded-full bg-tint-pink text-brand-pink-deep px-2 py-px text-[11px] font-bold">
                      {fresh === 1 ? "הגשה חדשה" : `${fresh} הגשות חדשות`}
                    </span>
                  )}
                  {fresh === 0 && total > 0 && (
                    <span className="text-[11.5px] font-normal text-ink-400">{appsLabel(total)}</span>
                  )}
                </button>
                {open && (
                  <div className="flex flex-col mt-1">
                    {group.map((j) => (
                      <AdminJobRow
                        key={j.id}
                        job={j}
                        appCounts={appCounts?.[j.id]}
                        className={key === "done" ? "opacity-70" : undefined}
                        selected={selection.has(j.id)}
                        onSelect={(on) =>
                          setSelection((prev) => {
                            const next = new Set(prev);
                            if (on) next.add(j.id);
                            else next.delete(j.id);
                            return next;
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {ours.length === 0 && (
            <p className="text-ink-500 text-sm py-4 bg-white border border-ink-200 rounded-[18px] px-5">
              {needle ? "אין משרות שלנו שתואמות לחיפוש." : "אין משרות שלנו עדיין."}
            </p>
          )}
        </div>
      ) : (
        <MarketTable rows={market} sort={sort} onSort={toggleSort} />
      )}
    </div>
  );
}

function sourceHost(url: string | null): string {
  if (!url) return "—";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "—";
  }
}

/**
 * The market tab: a plain sortable table — name, company, location, source,
 * publish date, link, one remove button. No pipeline, no lock, no
 * submissions: market jobs are a bulletin board, not a recruitment process.
 */
function MarketTable({
  rows,
  sort,
  onSort,
}: {
  rows: AdminJob[];
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (key: SortKey) => void;
}) {
  const TH = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th
      onClick={() => onSort(k)}
      className="text-start px-3 py-2 text-[11.5px] font-bold text-ink-500 uppercase cursor-pointer select-none hover:text-brand-purple whitespace-nowrap"
      title="לחיצה ממיינת לפי העמודה"
    >
      {children}
      {sort.key === k && <span className="ms-1">{sort.dir === -1 ? "↓" : "↑"}</span>}
    </th>
  );
  return (
    <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead className="bg-ink-50/60">
          <tr>
            <TH k="title">משרה</TH>
            <TH k="company">חברה</TH>
            <TH k="location">מיקום</TH>
            <th className="text-start px-3 py-2 text-[11.5px] font-bold text-ink-500 uppercase">מקור</th>
            <TH k="date">פורסמה</TH>
            <th className="px-3 py-2" />
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((j) => (
            <tr key={j.id} className="border-t border-ink-100 hover:bg-ink-50/50">
              <td className="px-3 py-2.5 font-semibold text-ink-900">{j.title}</td>
              <td className="px-3 py-2.5 text-ink-700">{j.company}</td>
              <td className="px-3 py-2.5 text-ink-700">{j.location ?? "—"}</td>
              <td className="px-3 py-2.5 text-ink-500" dir="ltr">{sourceHost(j.external_url)}</td>
              <td className="px-3 py-2.5 text-ink-700 tabular-nums">
                {DATE_HE.format(new Date(j.published_at ?? j.created_at ?? Date.now()))}
              </td>
              <td className="px-3 py-2.5">
                {j.external_url && (
                  <a
                    href={j.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand-purple font-semibold hover:underline"
                  >
                    <ExternalLink size={13} /> קישור
                  </a>
                )}
              </td>
              <td className="px-3 py-2.5">
                <ConfirmActionButton
                  action={deleteJob.bind(null, j.id)}
                  message={`להסיר את "${j.title}" מהלוח? הפעולה אינה ניתנת לביטול.`}
                  title="הסרה"
                  className="text-ink-300 hover:text-danger p-1"
                >
                  <Trash2 size={15} />
                </ConfirmActionButton>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-ink-500 text-sm">
                אין משרות שוק ברשימה.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
