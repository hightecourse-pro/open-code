"use client";

import { useMemo, useState } from "react";
import { Search, X, Download, FileText } from "lucide-react";
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

export function AdminCvTable({ rows }: { rows: AdminCvRow[] }) {
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<"" | CvLanguage>("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (lang && r.language !== lang) return false;
      if (needle) {
        const hay = `${r.member_name} ${r.specialization ?? ""} ${r.label} ${r.file_name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, lang]);

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
        <span className="text-[12px] text-ink-500 ms-auto">{shown.length} קבצים</span>
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
            {shown.map((r) => {
              const lng = LANG[r.language];
              return (
                <tr key={r.id}>
                  <td className="p-2 border-b border-ink-100">
                    <a
                      href={`/admin/members/${r.profile_id}`}
                      className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                    >
                      {r.member_name}
                    </a>
                  </td>
                  <td className="p-2 border-b border-ink-100 text-ink-700">{r.specialization || "—"}</td>
                  <td className="p-2 border-b border-ink-100">
                    <span className="inline-flex items-center gap-1.5 text-ink-700">
                      <FileText size={13} className="text-brand-pink-deep shrink-0" />
                      <span className="max-w-[220px] truncate" title={r.file_name ?? r.label}>
                        {r.label}
                      </span>
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
