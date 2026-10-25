"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface SummaryJudgeScore {
  id: string;
  name: string;
  total: number;
}
export interface SummaryRow {
  teamKey: string;
  challengeKey: string;
  team: string;
  judges: SummaryJudgeScore[];
  /** The automated report's suggested total, when it ran. */
  auto: number | null;
  average: number | null;
  gap: boolean;
  rank: number | null;
}

const RECOMMEND = 3;

/**
 * The owner's comparison (23/10): every project of every challenge with each
 * judge's total side by side, the automated check, the average, the gap flag
 * and the rank - the top three per challenge marked as recommended finalists.
 */
export function JudgingSummary({ rows, challenges }: { rows: SummaryRow[]; challenges: { key: string; short: string; emoji: string }[] }) {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState("all");
  const [sort, setSort] = useState<"rank" | "average" | "auto" | "team">("rank");
  const visible = rows.filter((r) => (only === "all" || r.challengeKey === only) && (!q.trim() || r.team.includes(q.trim())));
  const order = (a: SummaryRow, b: SummaryRow) => {
    switch (sort) {
      case "average":
        return (b.average ?? -1) - (a.average ?? -1) || a.team.localeCompare(b.team, "he");
      case "auto":
        return (b.auto ?? -1) - (a.auto ?? -1) || a.team.localeCompare(b.team, "he");
      case "team":
        return a.team.localeCompare(b.team, "he");
      default:
        return (a.rank ?? 999) - (b.rank ?? 999) || (b.average ?? -1) - (a.average ?? -1);
    }
  };
  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const judgeNames = [...new Set(rows.flatMap((r) => r.judges.map((j) => j.name)))];
    const head = ["אתגר", "צוות", ...judgeNames, "בדיקה אוטומטית", "ממוצע", "פער", "דירוג", "המלצה"];
    const lines = rows.map((r) =>
      [
        challenges.find((c) => c.key === r.challengeKey)?.short ?? r.challengeKey,
        r.team,
        ...judgeNames.map((n) => r.judges.find((j) => j.name === n)?.total ?? ""),
        r.auto ?? "",
        r.average ?? "",
        r.gap ? "כן" : "",
        r.rank ?? "",
        r.rank !== null && r.rank <= RECOMMEND ? "מומלצת לגמר" : "",
      ]
        .map(esc)
        .join(",")
    );
    const blob = new Blob(["﻿" + [head.map(esc).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hackathon-scores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4" data-testid="judging-summary">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-base font-bold">השוואת הציונים והמלצה</h3>
          <p className="text-[12.5px] text-ink-500 mt-0.5">כל שופטת בעמודה משלה, הבדיקה האוטומטית לצידן, ממוצע ודירוג בכל אתגר. שלוש הראשונות בכל אתגר מסומנות ״מומלצת לגמר״; פער מעל 15 בין שופטות מסומן.</p>
        </div>
        <Button type="button" size="sm" variant="secondary" className="ms-auto" onClick={exportCsv} disabled={rows.length === 0}>
          ייצוא ציונים CSV
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[12.5px]">
        <button type="button" onClick={() => setOnly("all")} className={cn("rounded-full px-3 py-1 font-semibold border", only === "all" ? "bg-brand-purple text-white border-brand-purple" : "bg-white text-ink-700 border-ink-200")}>
          כל האתגרים
        </button>
        {challenges.map((c) => (
          <button key={c.key} type="button" onClick={() => setOnly(c.key)} className={cn("rounded-full px-3 py-1 font-semibold border", only === c.key ? "bg-brand-purple text-white border-brand-purple" : "bg-white text-ink-700 border-ink-200")}>
            {c.emoji} {c.short}
          </button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="border border-ink-200 rounded-md px-2 py-1 bg-white" data-testid="summary-sort">
          <option value="rank">לפי דירוג</option>
          <option value="average">לפי ממוצע השופטות</option>
          <option value="auto">לפי הבדיקה האוטומטית</option>
          <option value="team">לפי שם</option>
        </select>
        <div className="relative ms-auto min-w-[200px]">
          <Search className="absolute top-1/2 -translate-y-1/2 end-3 h-4 w-4 text-ink-400" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש צוות" className="pe-9" data-testid="summary-search" />
        </div>
      </div>
      {challenges.map((c) => {
        const group = visible.filter((r) => r.challengeKey === c.key).sort(order);
        if (group.length === 0) return null;
        const judgeCols = [...new Map(group.flatMap((r) => r.judges.map((j) => [j.id, j.name] as const))).entries()];
        return (
          <div key={c.key} className="overflow-x-auto" data-testid="summary-challenge" data-key={c.key}>
            <div className="font-display font-bold text-[15px] text-ink-1000 mb-1.5">
              {c.emoji} {c.short} <span className="text-[12.5px] font-semibold text-ink-500">· {group.length} הגשות · {group.filter((r) => r.average !== null).length} עם ציון</span>
            </div>
            <table className="w-full text-[13px]">
              <thead className="bg-ink-50 text-ink-600 text-[12px]">
                <tr>
                  <th className="text-start px-2.5 py-1.5 font-semibold w-8">#</th>
                  <th className="text-start px-2.5 py-1.5 font-semibold">צוות</th>
                  {judgeCols.map(([id, name]) => (
                    <th key={id} className="text-center px-2.5 py-1.5 font-semibold whitespace-nowrap">
                      {name}
                    </th>
                  ))}
                  <th className="text-center px-2.5 py-1.5 font-semibold whitespace-nowrap">בדיקה אוטומטית</th>
                  <th className="text-center px-2.5 py-1.5 font-semibold">ממוצע</th>
                  <th className="text-start px-2.5 py-1.5 font-semibold">המלצה</th>
                </tr>
              </thead>
              <tbody>
                {group.map((r) => {
                  const top = r.rank !== null && r.rank <= RECOMMEND;
                  return (
                    <tr key={r.teamKey} className={cn("border-t border-ink-100", top && "bg-tint-mint/40")} data-testid="summary-row" data-team={r.teamKey}>
                      <td className="px-2.5 py-1.5 text-ink-500">{r.rank ?? "-"}</td>
                      <td className="px-2.5 py-1.5 font-semibold text-ink-900">{r.team}</td>
                      {judgeCols.map(([id]) => {
                        const j = r.judges.find((x) => x.id === id);
                        return (
                          <td key={id} className="px-2.5 py-1.5 text-center tabular-nums">
                            {j ? j.total : <span className="text-ink-300">-</span>}
                          </td>
                        );
                      })}
                      <td className="px-2.5 py-1.5 text-center tabular-nums text-ink-600">{r.auto ?? <span className="text-ink-300">-</span>}</td>
                      <td className="px-2.5 py-1.5 text-center tabular-nums font-bold text-ink-900">{r.average ?? <span className="text-ink-300 font-normal">-</span>}</td>
                      <td className="px-2.5 py-1.5">
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          {top && <Badge variant="mint">מומלצת לגמר</Badge>}
                          {r.gap && <Badge variant="warm">פער בין השופטות - צריך שלישית</Badge>}
                          {r.judges.length === 1 && <span className="text-[11.5px] text-ink-500">שופטת אחת בלבד</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </section>
  );
}
