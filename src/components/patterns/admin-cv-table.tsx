"use client";

import { useMemo, useState } from "react";
import { Search, X, Download, FileText, ChevronDown, ChevronUp } from "lucide-react";
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
}

const LANG: Record<CvLanguage, { label: string; variant: "pink" | "indigo" | "mint" }> = {
  he: { label: "עברית", variant: "pink" },
  en: { label: "אנגלית", variant: "indigo" },
  job: { label: "מותאם למשרה", variant: "mint" },
};

const FILTERS: { value: "" | CvLanguage; label: string }[] = [
  { value: "", label: "הכל" },
  { value: "he", label: "עברית" },
  { value: "en", label: "אנגלית" },
  { value: "job", label: "מותאם למשרה" },
];

/** One member and her documents — the default one first, then newest-first. */
interface MemberGroup {
  profile_id: string;
  member_name: string;
  specialization: string | null;
  docs: AdminCvRow[];
}

export function AdminCvTable({ rows }: { rows: AdminCvRow[] }) {
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<"" | CvLanguage>("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

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
          docs: [],
        };
        byMember.set(r.profile_id, g);
      }
      g.docs.push(r);
    }
    // Rows arrive newest-first; float the default document to the top of each
    // group so staff always see the file she considers current.
    for (const g of byMember.values()) {
      g.docs.sort((a, b) => Number(b.is_default) - Number(a.is_default));
    }
    return [...byMember.values()];
  }, [rows]);

  const filterActive = q.trim() !== "" || lang !== "";

  // Filter per document, then keep any group with at least one match — a hit
  // inside a collapsed group must surface that group.
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups
      .map((g) => {
        const docs = g.docs.filter((r) => {
          if (lang && r.language !== lang) return false;
          if (needle) {
            const hay =
              `${r.member_name} ${r.specialization ?? ""} ${r.label} ${r.file_name ?? ""}`.toLowerCase();
            if (!hay.includes(needle)) return false;
          }
          return true;
        });
        return { ...g, docs };
      })
      .filter((g) => g.docs.length > 0);
  }, [groups, q, lang]);

  const docCount = shown.reduce((n, g) => n + g.docs.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* instant search + language filter */}
      <div className="bg-white border border-ink-200 rounded-md p-3 flex flex-wrap gap-2 items-center shadow-sm">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי שם / תחום / שם קובץ…"
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
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setLang(f.value)}
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
        <span className="text-[12px] text-ink-500 ms-auto">
          {docCount} קבצים · {shown.length} חברות
        </span>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {["חברה", "תחום", "קובץ", "שפה", "הועלה", ""].map((h, i) => (
                <th
                  key={i}
                  className="text-right p-2 text-[11px] text-ink-500 uppercase font-semibold border-b border-ink-200"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => {
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
                      ) : null}
                    </td>
                    <td className="p-2 border-b border-ink-100 text-ink-700 align-top">
                      {head ? g.specialization || "—" : null}
                    </td>
                    <td className="p-2 border-b border-ink-100">
                      <span className="inline-flex items-center gap-1.5 text-ink-700 flex-wrap">
                        <FileText size={13} className="text-brand-pink-deep shrink-0" />
                        <span className="max-w-[220px] truncate" title={r.file_name ?? r.label}>
                          {r.label}
                        </span>
                        {r.is_default && (
                          <Badge variant="grad" className="px-2 py-[2px] text-[10.5px]">
                            ברירת המחדל שלה
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="p-2 border-b border-ink-100">
                      <Badge variant={lng.variant}>{lng.label}</Badge>
                    </td>
                    <td className="p-2 border-b border-ink-100 text-ink-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("he-IL")}
                    </td>
                    <td className="p-2 border-b border-ink-100">
                      {r.download_url ? (
                        <a
                          href={r.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-brand-gradient rounded-md px-3 py-1.5"
                        >
                          <Download size={13} /> הורדה
                        </a>
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
                <td colSpan={6} className="p-6 text-center text-ink-500">
                  {rows.length === 0 ? "עדיין לא הועלו קורות חיים." : "לא נמצאו קבצים בסינון הזה."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
