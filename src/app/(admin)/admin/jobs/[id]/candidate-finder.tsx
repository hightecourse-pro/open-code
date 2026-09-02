"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { aiRankCandidates, setCandidateStatus, type TriageStatus } from "./finder-actions";

export interface FinderCandidate {
  profileId: string;
  name: string;
  specialization: string | null;
  region: string | null;
  years: number | null;
  score: number;
  matched: string[];
  missing: string[];
  extra: string[];
  applied: boolean;
  appliedAnswers: { q: string; a: string }[];
  status: TriageStatus;
  aiScore: number | null;
  aiReason: string | null;
}

const STATUS_DEF: { id: TriageStatus; label: string; chip: string }[] = [
  { id: "new", label: "טרם נבדקה", chip: "bg-ink-100 text-ink-700" },
  { id: "fit", label: "מתאימה ✓", chip: "bg-tint-mint text-[#0E6B4A]" },
  { id: "maybe", label: "אולי", chip: "bg-tint-warm text-[#8C5E0E]" },
  { id: "no", label: "לא רלוונטית", chip: "bg-ink-100 text-ink-500" },
];
const statusDef = (s: TriageStatus) => STATUS_DEF.find((d) => d.id === s) ?? STATUS_DEF[0];

function Chips({ items, tone, cap = 8 }: { items: string[]; tone: "match" | "miss" | "extra"; cap?: number }) {
  if (!items.length) return null;
  const cls =
    tone === "match"
      ? "bg-tint-mint text-[#0E6B4A] border-[#B7E3B0]"
      : tone === "miss"
        ? "bg-ink-50 text-ink-400 border-ink-200 line-through"
        : "bg-tint-purple/50 text-brand-purple border-brand-purple/20";
  return (
    <span className="inline-flex flex-wrap gap-1">
      {items.slice(0, cap).map((t) => (
        <span key={t} className={cn("border rounded-full px-2 py-px text-[11px] font-semibold", cls)}>
          {t}
        </span>
      ))}
      {items.length > cap && <span className="text-[11px] text-ink-400">+{items.length - cap}</span>}
    </span>
  );
}

/**
 * The finder (the owner, 2/9): every candidate — applicants or the whole
 * community — scored by PRACTICAL tech only, reviewable as a sortable table
 * or one-by-one cards with saved verdicts, plus an optional AI ranking pass.
 */
export function CandidateFinder({
  jobId,
  candidates,
  appliedCount,
}: {
  jobId: string;
  candidates: FinderCandidate[];
  appliedCount: number;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<"applied" | "all">(appliedCount > 0 ? "applied" : "all");
  const [statusFilter, setStatusFilter] = useState<"" | TriageStatus>("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "ai" | "years">("score");
  const [cardIndex, setCardIndex] = useState<number | null>(null);
  const [local, setLocal] = useState<Record<string, TriageStatus>>({});
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [aiPending, startAi] = useTransition();

  const statusOf = (c: FinderCandidate): TriageStatus => local[c.profileId] ?? c.status;

  const filtered = useMemo(() => {
    let list = scope === "applied" ? candidates.filter((c) => c.applied) : candidates;
    if (statusFilter) list = list.filter((c) => statusOf(c) === statusFilter);
    const q = search.trim();
    if (q) list = list.filter((c) => (c.name + " " + (c.specialization ?? "") + " " + (c.region ?? "")).includes(q));
    return [...list].sort((a, b) => {
      if (sortBy === "ai") return (b.aiScore ?? -1) - (a.aiScore ?? -1) || b.score - a.score;
      if (sortBy === "years") return (b.years ?? -1) - (a.years ?? -1) || b.score - a.score;
      return b.score - a.score || (b.years ?? -1) - (a.years ?? -1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, scope, statusFilter, search, sortBy, local]);

  const mark = (c: FinderCandidate, status: TriageStatus, advance = false) => {
    setLocal((s) => ({ ...s, [c.profileId]: status }));
    void setCandidateStatus(jobId, c.profileId, status);
    if (advance) setCardIndex((i) => (i === null ? null : Math.min(i + 1, filtered.length - 1)));
  };

  // Card-mode keyboard: 1/2/3 = מתאימה/אולי/לא, arrows navigate, Esc closes.
  useEffect(() => {
    if (cardIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      const c = filtered[cardIndex];
      if (!c) return;
      if (e.key === "1") mark(c, "fit", true);
      else if (e.key === "2") mark(c, "maybe", true);
      else if (e.key === "3") mark(c, "no", true);
      else if (e.key === "ArrowLeft") setCardIndex((i) => Math.min((i ?? 0) + 1, filtered.length - 1));
      else if (e.key === "ArrowRight") setCardIndex((i) => Math.max((i ?? 0) - 1, 0));
      else if (e.key === "Escape") setCardIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIndex, filtered]);

  const counts = useMemo(() => {
    const base = scope === "applied" ? candidates.filter((c) => c.applied) : candidates;
    const n: Record<string, number> = { "": base.length };
    for (const d of STATUS_DEF) n[d.id] = base.filter((c) => statusOf(c) === d.id).length;
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, scope, local]);

  const runAi = () => {
    setAiMsg(null);
    const payload = filtered.slice(0, 60).map((c) => ({
      profileId: c.profileId,
      name: c.name,
      years: c.years,
      practical: [...c.matched, ...c.extra],
      workSummary: c.specialization ?? "",
    }));
    startAi(async () => {
      const res = await aiRankCandidates(jobId, payload);
      if (!res.ok) setAiMsg(res.error ?? "הדירוג נכשל");
      else {
        setAiMsg(`✓ ${res.ranked} מועמדות דורגו — הרשימה התעדכנה`);
        setSortBy("ai");
        router.refresh();
      }
    });
  };

  const card = cardIndex !== null ? filtered[cardIndex] : null;

  return (
    <div className="flex flex-col gap-3">
      {/* controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-full border border-ink-200 overflow-hidden">
          {(
            [
              { id: "applied", label: `הגישו (${appliedCount})` },
              { id: "all", label: `כל הקהילה (${candidates.length})` },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScope(s.id)}
              className={cn(
                "px-3.5 py-1.5 text-[12.5px] font-semibold cursor-pointer",
                scope === s.id ? "bg-brand-gradient text-white" : "bg-white text-ink-700 hover:bg-ink-50"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש שם / תחום / אזור…"
          className="border border-ink-200 rounded-md px-3 py-1.5 text-[13px] w-52 focus:outline-none focus:border-brand-purple"
        />
        <button
          type="button"
          onClick={() => setCardIndex(filtered.length ? 0 : null)}
          disabled={!filtered.length}
          className="font-display font-semibold text-[13px] px-4 py-1.5 rounded-md border-[1.5px] border-brand-purple text-brand-purple hover:bg-tint-purple transition-colors disabled:opacity-50 cursor-pointer"
        >
          ⚡ סקירה אחת-אחת
        </button>
        <button
          type="button"
          onClick={runAi}
          disabled={aiPending || !filtered.length}
          className="font-display font-semibold text-[13px] px-4 py-1.5 rounded-md bg-brand-gradient text-white disabled:opacity-60 cursor-pointer"
        >
          {aiPending ? "ה-AI חושב…" : "🤖 דירוג AI"}
        </button>
        {aiMsg && <span className="text-[12.5px] text-ink-700">{aiMsg}</span>}
      </div>

      {/* status filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {[{ id: "" as const, label: "הכל", chip: "bg-white border border-ink-200 text-ink-700" }, ...STATUS_DEF].map(
          (d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setStatusFilter(d.id as "" | TriageStatus)}
              aria-pressed={statusFilter === d.id}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-bold cursor-pointer",
                d.chip,
                statusFilter === d.id && "ring-2 ring-brand-purple"
              )}
            >
              {d.label} ({counts[d.id] ?? 0})
            </button>
          )
        )}
        <span className="ms-auto text-[12px] text-ink-500 self-center">
          מיון:{" "}
          {(
            [
              { id: "score", label: "התאמה מעשית" },
              { id: "ai", label: "ציון AI" },
              { id: "years", label: "שנות ניסיון" },
            ] as const
          ).map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSortBy(s.id)}
              className={cn(
                "cursor-pointer hover:text-brand-purple",
                i > 0 && "ms-2",
                sortBy === s.id && "font-bold text-brand-purple"
              )}
            >
              {s.label}
            </button>
          ))}
        </span>
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-ink-500 text-xs text-right border-b border-ink-100">
              <th className="py-2 font-semibold">מועמדת</th>
              <th className="py-2 font-semibold">התאמה</th>
              <th className="py-2 font-semibold">טכנולוגיות מניסיון מעשי</th>
              <th className="py-2 font-semibold">שנות ניסיון</th>
              <th className="py-2 font-semibold">AI</th>
              <th className="py-2 font-semibold">סטטוס</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.profileId} className="border-b border-ink-50 last:border-b-0 align-top">
                <td className="py-2.5 pe-2 min-w-[150px]">
                  <a
                    href={`/admin/members/${c.profileId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                  >
                    {c.name}
                  </a>
                  <div className="text-[11.5px] text-ink-500">
                    {[c.specialization, c.region].filter(Boolean).join(" · ") || "—"}
                    {c.applied && (
                      <span className="ms-1.5 inline-flex rounded-full bg-tint-pink text-brand-pink-deep px-1.5 text-[10.5px] font-bold">
                        הגישה
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 pe-2 tabular-nums font-bold text-ink-900">{c.score}%</td>
                <td className="py-2.5 pe-2 max-w-[320px]">
                  <Chips items={c.matched} tone="match" />
                  {c.matched.length === 0 && <span className="text-[11.5px] text-ink-400">אין חפיפה מעשית</span>}
                  {c.missing.length > 0 && (
                    <div className="mt-0.5">
                      <Chips items={c.missing} tone="miss" cap={5} />
                    </div>
                  )}
                </td>
                <td className="py-2.5 pe-2 tabular-nums">{c.years ?? "—"}</td>
                <td className="py-2.5 pe-2">
                  {c.aiScore !== null ? (
                    <span className="font-bold tabular-nums" title={c.aiReason ?? ""}>
                      {c.aiScore}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 pe-2">
                  <select
                    value={statusOf(c)}
                    onChange={(e) => mark(c, e.target.value as TriageStatus)}
                    className={cn("rounded-full px-2 py-1 text-[11.5px] font-bold border-0 cursor-pointer", statusDef(statusOf(c)).chip)}
                  >
                    {STATUS_DEF.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2.5">
                  <button
                    type="button"
                    onClick={() => setCardIndex(i)}
                    className="text-[12px] font-semibold text-brand-purple hover:underline cursor-pointer"
                  >
                    כרטיס ←
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-[13px] text-ink-500 text-center py-6">אין מועמדות בסינון הנוכחי</p>
        )}
      </div>

      {/* one-by-one card */}
      {card && (
        <div className="fixed inset-0 z-50 bg-ink-1000/50 flex items-center justify-center p-4" onClick={() => setCardIndex(null)}>
          <div
            className="bg-white rounded-[20px] shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[12px] text-ink-400">
                  {cardIndex! + 1} מתוך {filtered.length}
                  {card.applied && <span className="ms-2 text-brand-pink-deep font-bold">· הגישה מועמדות</span>}
                </div>
                <h3 className="font-display font-black text-[22px]">
                  <a href={`/admin/members/${card.profileId}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-purple">
                    {card.name}
                  </a>
                </h3>
                <div className="text-[13px] text-ink-500">
                  {[card.specialization, card.region, card.years !== null ? `${card.years} שנות ניסיון` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
              <div className="text-center shrink-0">
                <div className="font-display font-black text-[26px] text-brand-purple tabular-nums">{card.score}%</div>
                <div className="text-[11px] text-ink-400">התאמה מעשית</div>
                {card.aiScore !== null && (
                  <div className="text-[12px] mt-1 tabular-nums">
                    AI: <b>{card.aiScore}</b>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-[13px]">
              <div>
                <span className="font-semibold">תואם מהדרישות: </span>
                <Chips items={card.matched} tone="match" cap={20} />
                {!card.matched.length && <span className="text-ink-400">אין חפיפה מעשית לדרישות</span>}
              </div>
              {card.missing.length > 0 && (
                <div>
                  <span className="font-semibold">חסר: </span>
                  <Chips items={card.missing} tone="miss" cap={20} />
                </div>
              )}
              {card.extra.length > 0 && (
                <div>
                  <span className="font-semibold">עוד ניסיון מעשי: </span>
                  <Chips items={card.extra} tone="extra" cap={20} />
                </div>
              )}
              {card.aiReason && (
                <div className="bg-tint-purple/40 border border-brand-purple/20 rounded-[12px] px-3 py-2 mt-1">
                  🤖 {card.aiReason}
                </div>
              )}
            </div>

            {card.appliedAnswers.length > 0 && (
              <div className="border-t border-ink-100 pt-3 flex flex-col gap-2">
                <div className="font-semibold text-[13.5px]">התשובות שלה לשאלות המשרה:</div>
                {card.appliedAnswers.map((qa, j) => (
                  <div key={j} className="text-[13px]">
                    <div className="text-ink-500">{qa.q}</div>
                    <div className="text-ink-900 whitespace-pre-wrap">{qa.a || "—"}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-ink-100 pt-3 flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => mark(card, "fit", true)} className="flex-1 min-w-[110px] font-display font-bold text-[14px] py-2.5 rounded-md bg-tint-mint text-[#0E6B4A] border border-[#B7E3B0] hover:brightness-95 cursor-pointer">
                מתאימה ✓ <span className="opacity-60 text-[11px]">(1)</span>
              </button>
              <button type="button" onClick={() => mark(card, "maybe", true)} className="flex-1 min-w-[90px] font-display font-bold text-[14px] py-2.5 rounded-md bg-tint-warm text-[#8C5E0E] border border-[#F8D98C] hover:brightness-95 cursor-pointer">
                אולי <span className="opacity-60 text-[11px]">(2)</span>
              </button>
              <button type="button" onClick={() => mark(card, "no", true)} className="flex-1 min-w-[110px] font-display font-bold text-[14px] py-2.5 rounded-md bg-ink-100 text-ink-600 hover:brightness-95 cursor-pointer">
                לא רלוונטית <span className="opacity-60 text-[11px]">(3)</span>
              </button>
              <div className="w-full flex items-center justify-between text-[12px] text-ink-400 mt-1">
                <button type="button" onClick={() => setCardIndex(Math.max(cardIndex! - 1, 0))} className="hover:text-ink-900 cursor-pointer">→ הקודמת</button>
                <span>מקשים: 1/2/3 לסימון · חצים לדפדוף · Esc לסגירה</span>
                <button type="button" onClick={() => setCardIndex(Math.min(cardIndex! + 1, filtered.length - 1))} className="hover:text-ink-900 cursor-pointer">הבאה ←</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
