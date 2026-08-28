"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Download,
  Eye,
  FileText,
  ChevronDown,
  ChevronUp,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { CvLanguage } from "@/types/database";

export interface AdminCvRow {
  id: string;
  profile_id: string;
  member_name: string;
  specialization: string | null;
  label: string;
  language: CvLanguage;
  file_name: string | null;
  created_at: string;
  is_default: boolean;
  download_url: string | null;
  job_id: string | null;
  job_title: string | null;
}

// Language is a real language; "job-tailored" is a TYPE, not a language —
// it renders as a badge on the file column, next to the default marker.
const LANG: Record<string, { label: string; variant: "pink" | "indigo" }> = {
  he: { label: "עברית", variant: "pink" },
  en: { label: "אנגלית", variant: "indigo" },
};

const LANG_FILTERS: { value: "" | "he" | "en"; label: string }[] = [
  { value: "", label: "כל שפה" },
  { value: "he", label: "עברית" },
  { value: "en", label: "אנגלית" },
];

const TYPE_FILTERS: { value: "" | "plain" | "job"; label: string }[] = [
  { value: "", label: "כל סוג" },
  { value: "plain", label: "רגיל" },
  { value: "job", label: "מותאם למשרה" },
];

/** PDF / Word, from the file name. */
function fileKind(name: string | null): string {
  if (!name) return "—";
  if (/\.pdf$/i.test(name)) return "PDF";
  if (/\.docx?$/i.test(name)) return "Word";
  return name.split(".").pop()?.toUpperCase() ?? "—";
}

/** One member and her documents — the default one first, then newest-first. */
interface MemberGroup {
  profile_id: string;
  member_name: string;
  specialization: string | null;
  latest: string;
  docs: AdminCvRow[];
}

const DMY = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

type SortKey = "name" | "latest";
const PAGE_SIZE = 20;

export function AdminCvTable({ rows }: { rows: AdminCvRow[] }) {
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<"" | "he" | "en">("");
  const [type, setType] = useState<"" | "plain" | "job">("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<SortKey>("latest");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  // The member model is deliberately multi-document (Hebrew / English /
  // job-tailored), so a flat list shows the same member 2-3 times. Group her
  // files together: the default document leads, the rest fold under it.
  const groups = useMemo(() => {
    const byMember = new Map<string, MemberGroup>();
    for (const r of rows) {
      let g = byMember.get(r.profile_id);
      if (!g) {
        g = {
          profile_id: r.profile_id,
          member_name: r.member_name,
          specialization: r.specialization,
          latest: r.created_at,
          docs: [],
        };
        byMember.set(r.profile_id, g);
      }
      g.docs.push(r);
      if (r.created_at > g.latest) g.latest = r.created_at;
    }
    // Rows arrive newest-first; float the default document to the top of each
    // group so staff always see the file she considers current.
    for (const g of byMember.values()) {
      g.docs.sort((a, b) => Number(b.is_default) - Number(a.is_default));
    }
    return [...byMember.values()];
  }, [rows]);

  const filterActive = q.trim() !== "" || lang !== "" || type !== "";

  // Filter per document, then keep any group with at least one match — a hit
  // inside a collapsed group must surface that group. Then sort the groups.
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = groups
      .map((g) => {
        const docs = g.docs.filter((r) => {
          if (lang && r.language !== lang) return false;
          if (type === "job" && r.language !== "job") return false;
          if (type === "plain" && r.language === "job") return false;
          if (needle) {
            const hay =
              `${r.member_name} ${r.specialization ?? ""} ${r.label} ${r.file_name ?? ""} ${r.job_title ?? ""}`.toLowerCase();
            if (!hay.includes(needle)) return false;
          }
          return true;
        });
        return { ...g, docs };
      })
      .filter((g) => g.docs.length > 0);
    list.sort((a, b) => {
      const d =
        sortKey === "name"
          ? a.member_name.localeCompare(b.member_name, "he")
          : a.latest.localeCompare(b.latest);
      return sortAsc ? d : -d;
    });
    return list;
  }, [groups, q, lang, type, sortKey, sortAsc]);

  const docCount = shown.reduce((n, g) => n + g.docs.length, 0);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageGroups = shown.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const selectedRows = rows.filter((r) => selected[r.id] && r.download_url);

  // Sequential hidden-anchor clicks: each signed URL carries ?download=, so
  // the browser saves instead of navigating. A small gap keeps it reliable.
  async function bulkDownload() {
    setBulkBusy(true);
    for (const r of selectedRows) {
      const url = `${r.download_url}&download=${encodeURIComponent(r.file_name ?? "cv")}`;
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((res) => setTimeout(res, 400));
    }
    setBulkBusy(false);
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  // A render helper, not a component — components born in render remount.
  const sortIcon = (active: boolean) =>
    !active ? null : sortAsc ? <ArrowUpAZ size={12} /> : <ArrowDownAZ size={12} />;

  return (
    <div className="flex flex-col gap-4">
      {/* instant search + split language/type filters */}
      <div className="bg-white border border-ink-200 rounded-md p-3 flex flex-wrap gap-2 items-center shadow-sm">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="חיפוש לפי שם / תחום / שם קובץ / משרה…"
            className="w-full ps-9 pe-8 py-2 rounded-md border border-ink-300 text-sm outline-none focus:border-brand-purple"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="ניקוי חיפוש"
              className="absolute top-1/2 -translate-y-1/2 end-2 text-ink-400 hover:text-ink-700"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {LANG_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setLang(f.value);
                setPage(0);
              }}
              className={cn(
                "text-[12.5px] font-semibold px-3 py-1.5 rounded-full border transition-colors",
                lang === f.value
                  ? "bg-brand-gradient text-white border-transparent"
                  : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setType(f.value);
                setPage(0);
              }}
              className={cn(
                "text-[12.5px] font-semibold px-3 py-1.5 rounded-full border transition-colors",
                type === f.value
                  ? "bg-ink-1000 text-white border-transparent"
                  : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-ink-500 ms-auto">
          {docCount} קבצים · {shown.length} חברות
        </span>
      </div>

      {selectedRows.length > 0 && (
        <div className="bg-tint-purple border border-[#DDC9EC] rounded-md px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <span className="text-[13px] font-semibold text-brand-purple">
            נבחרו {selectedRows.length} קבצים
          </span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={bulkDownload}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-white bg-brand-gradient rounded-md px-3.5 py-1.5 cursor-pointer disabled:opacity-60"
          >
            <Download size={13} /> {bulkBusy ? "מורידה…" : "הורדת כל הנבחרים"}
          </button>
          <button
            type="button"
            onClick={() => setSelected({})}
            className="text-[12px] text-ink-500 hover:text-ink-900 underline cursor-pointer"
          >
            ניקוי בחירה
          </button>
        </div>
      )}

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className="p-2 border-b border-ink-200 w-8" />
              <th className="text-right p-2 text-[11px] text-ink-500 uppercase font-semibold border-b border-ink-200">
                <button
                  type="button"
                  onClick={() => toggleSort("name")}
                  className="inline-flex items-center gap-1 cursor-pointer hover:text-brand-purple"
                >
                  חברה {sortIcon(sortKey === "name")}
                </button>
              </th>
              {["תחום", "קובץ", "סוג", "שפה", "הועלה"].map((h) => (
                <th
                  key={h}
                  className="text-right p-2 text-[11px] text-ink-500 uppercase font-semibold border-b border-ink-200"
                >
                  {h}
                </th>
              ))}
              <th className="text-right p-2 text-[11px] text-ink-500 uppercase font-semibold border-b border-ink-200">
                <button
                  type="button"
                  onClick={() => toggleSort("latest")}
                  className="inline-flex items-center gap-1 cursor-pointer hover:text-brand-purple"
                >
                  עדכון אחרון {sortIcon(sortKey === "latest")}
                </button>
              </th>
              <th className="p-2 border-b border-ink-200" />
            </tr>
          </thead>
          <tbody>
            {pageGroups.map((g) => {
              const [primary, ...others] = g.docs;
              // While a filter is on, every match must be visible — collapsing
              // would hide the very rows the filter found.
              const expanded = filterActive || !!open[g.profile_id];
              const visible = expanded ? g.docs : [primary];
              return visible.map((r, i) => {
                const lng = LANG[r.language];
                const head = i === 0;
                return (
                  <tr key={r.id} className={cn(!head && "bg-ink-50/50")}>
                    <td className={cn("p-2 border-b border-ink-100 align-top", !head && "border-s-[3px] border-s-ink-200")}>
                      <input
                        type="checkbox"
                        checked={!!selected[r.id]}
                        onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))}
                        aria-label="בחירת קובץ"
                        className="accent-[#8B5CF6] cursor-pointer"
                      />
                    </td>
                    <td className="p-2 border-b border-ink-100 align-top">
                      {head ? (
                        <>
                          <a
                            href={`/admin/members/${g.profile_id}`}
                            className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                          >
                            {g.member_name}
                          </a>
                          {others.length > 0 && !filterActive && (
                            <button
                              type="button"
                              onClick={() =>
                                setOpen((o) => ({ ...o, [g.profile_id]: !o[g.profile_id] }))
                              }
                              aria-expanded={expanded}
                              className="flex items-center gap-1 mt-0.5 text-[11.5px] font-semibold text-brand-purple hover:underline"
                            >
                              {expanded ? (
                                <>
                                  <ChevronUp size={12} /> הצגת פחות
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={12} /> עוד {others.length === 1 ? "קובץ אחד" : `${others.length} קבצים`}
                                </>
                              )}
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-[11.5px] text-ink-400 ps-2">└ קובץ נוסף שלה</span>
                      )}
                    </td>
                    <td className="p-2 border-b border-ink-100 text-ink-700 align-top">
                      {head ? g.specialization || "—" : null}
                    </td>
                    <td className="p-2 border-b border-ink-100">
                      <span className="inline-flex items-center gap-1.5 text-ink-700 flex-wrap">
                        <FileText size={13} className="text-brand-pink-deep shrink-0" />
                        <span className="max-w-[200px] truncate" title={r.file_name ?? r.label}>
                          {r.label}
                        </span>
                        {r.is_default && (
                          <Badge variant="grad" className="px-2 py-[2px] text-[10.5px]">
                            ברירת המחדל שלה
                          </Badge>
                        )}
                        {r.language === "job" && (
                          <Badge variant="mint" className="px-2 py-[2px] text-[10.5px]">
                            מותאם למשרה
                          </Badge>
                        )}
                        {r.language === "job" && r.job_id && (
                          <a
                            href={`/admin/jobs/${r.job_id}`}
                            className="text-[11.5px] font-semibold text-brand-purple hover:underline"
                            title={r.job_title ?? undefined}
                          >
                            למשרה ←
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="p-2 border-b border-ink-100 text-ink-600 text-[12.5px] font-mono">
                      {fileKind(r.file_name)}
                    </td>
                    <td className="p-2 border-b border-ink-100">
                      {lng ? <Badge variant={lng.variant}>{lng.label}</Badge> : <span className="text-ink-400">—</span>}
                    </td>
                    <td className="p-2 border-b border-ink-100 text-ink-500 whitespace-nowrap">
                      {DMY.format(new Date(r.created_at))}
                    </td>
                    <td className="p-2 border-b border-ink-100 text-ink-500 whitespace-nowrap">
                      {head ? DMY.format(new Date(g.latest)) : null}
                    </td>
                    <td className="p-2 border-b border-ink-100">
                      {r.download_url ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <a
                            href={r.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="תצוגה מקדימה בכרטיסייה חדשה"
                            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-purple border border-brand-purple/40 rounded-md px-2.5 py-1.5 hover:bg-tint-purple"
                          >
                            <Eye size={13} /> תצוגה
                          </a>
                          <a
                            href={`${r.download_url}&download=${encodeURIComponent(r.file_name ?? "cv")}`}
                            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-white bg-brand-gradient rounded-md px-2.5 py-1.5"
                          >
                            <Download size={13} /> הורדה
                          </a>
                        </span>
                      ) : (
                        <span className="text-[12px] text-ink-400">לא זמין</span>
                      )}
                    </td>
                  </tr>
                );
              });
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-ink-500">
                  {rows.length === 0 ? "עדיין לא הועלו קורות חיים." : "לא נמצאו קבצים בסינון הזה."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            className="text-[12.5px] font-semibold text-brand-purple disabled:text-ink-300 cursor-pointer disabled:cursor-default"
          >
            → הקודם
          </button>
          <span className="text-[12px] text-ink-500">
            עמוד {safePage + 1} מתוך {pages}
          </span>
          <button
            type="button"
            disabled={safePage >= pages - 1}
            onClick={() => setPage(safePage + 1)}
            className="text-[12.5px] font-semibold text-brand-purple disabled:text-ink-300 cursor-pointer disabled:cursor-default"
          >
            הבא ←
          </button>
        </div>
      )}
    </div>
  );
}
