"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface DashboardPerson {
  id: string;
  challengeKey: string;
  seminar: string | null;
  /** The graduation year as the member reads it (תשפ״ו), free text kept as typed. */
  year: string | null;
  submitted: boolean;
}

interface Bucket {
  key: string;
  n: number;
  submitted: number;
}

function bucketize(people: DashboardPerson[], pick: (p: DashboardPerson) => string | null): Bucket[] {
  const m = new Map<string, Bucket>();
  for (const p of people) {
    const k = (pick(p) ?? "").trim() || "לא צוין";
    const b = m.get(k) ?? { key: k, n: 0, submitted: 0 };
    b.n++;
    if (p.submitted) b.submitted++;
    m.set(k, b);
  }
  return [...m.values()];
}

/**
 * The hackathon at a glance (the owner, 25/10): who registered, by seminar
 * and by graduation year, with how many of each already submitted. A row is
 * a filter - it narrows the registrations list below through the URL, so the
 * list and the dashboard always agree.
 */
export function HackathonDashboard({ people, challenges }: { people: DashboardPerson[]; challenges: { key: string; short: string; emoji: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const activeSeminar = sp.get("seminar") ?? "";
  const activeYear = sp.get("year") ?? "";
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"count" | "name" | "submitted">("count");

  const total = people.length;
  const submitted = people.filter((p) => p.submitted).length;
  const perChallenge = challenges.map((c) => ({ ...c, n: people.filter((p) => p.challengeKey === c.key).length, submitted: people.filter((p) => p.challengeKey === c.key && p.submitted).length }));
  const sorter = (a: Bucket, b: Bucket) => (sortBy === "name" ? a.key.localeCompare(b.key, "he") : sortBy === "submitted" ? b.submitted - a.submitted || b.n - a.n : b.n - a.n || a.key.localeCompare(b.key, "he"));
  const seminars = useMemo(() => bucketize(people, (p) => p.seminar).filter((b) => !q.trim() || b.key.includes(q.trim())).sort(sorter), [people, q, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps
  const years = useMemo(() => bucketize(people, (p) => p.year).sort(sorter), [people, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  function setParam(key: "seminar" | "year", value: string) {
    const p = new URLSearchParams(sp.toString());
    if (value && p.get(key) !== value) p.set(key, value);
    else p.delete(key);
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4" data-testid="hackathon-dashboard">
      <div className="flex items-center gap-2 flex-wrap">
        <Tile label="רשומות" value={total} tone="purple" />
        <Tile label="הגישו" value={`${submitted}`} sub={total ? `${Math.round((submitted / total) * 100)}%` : undefined} tone="pink" />
        {perChallenge.map((c) => (
          <Tile key={c.key} label={`${c.emoji} ${c.short}`} value={c.n} sub={`${c.submitted} הגישו`} tone="gray" />
        ))}
        <div className="ms-auto flex items-center gap-2">
          <label className="text-[12px] text-ink-500">מיון</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="text-[12.5px] border border-ink-200 rounded-md px-2 py-1 bg-white" data-testid="dashboard-sort">
            <option value="count">לפי כמות</option>
            <option value="submitted">לפי הגשות</option>
            <option value="name">לפי שם</option>
          </select>
        </div>
      </div>
      {(activeSeminar || activeYear) && (
        <div className="flex items-center gap-2 flex-wrap text-[12.5px]" data-testid="dashboard-active-filters">
          <span className="text-ink-500">הרשימה למטה מסוננת:</span>
          {activeSeminar && (
            <button type="button" onClick={() => setParam("seminar", "")} className="rounded-full bg-brand-purple text-white px-3 py-0.5 font-semibold">
              {activeSeminar} ✕
            </button>
          )}
          {activeYear && (
            <button type="button" onClick={() => setParam("year", "")} className="rounded-full bg-brand-pink-deep text-white px-3 py-0.5 font-semibold">
              {activeYear} ✕
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="flex flex-col gap-2" data-testid="dashboard-seminars">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-bold text-[14px] text-ink-1000">לפי סמינר ({seminars.length})</h3>
            <div className="relative ms-auto w-48">
              <Search className="absolute top-1/2 -translate-y-1/2 end-2.5 h-3.5 w-3.5 text-ink-400" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש סמינר" className="pe-8 h-8 text-[12.5px]" />
            </div>
          </div>
          <BarList buckets={seminars} active={activeSeminar} onPick={(k) => setParam("seminar", k)} testid="seminar-row" />
        </div>
        <div className="flex flex-col gap-2" data-testid="dashboard-years">
          <h3 className="font-display font-bold text-[14px] text-ink-1000">לפי שנת סיום לימודים ({years.length})</h3>
          <BarList buckets={years} active={activeYear} onPick={(k) => setParam("year", k)} testid="year-row" />
        </div>
      </div>
      <p className="text-[11.5px] text-ink-400">הסרגל המלא = רשומות; החלק הכהה = מתוכן שכבר הגישו. לחיצה על שורה מסננת את הרשומות למטה, לחיצה נוספת מבטלת.</p>
    </div>
  );
}

function BarList({ buckets, active, onPick, testid }: { buckets: Bucket[]; active: string; onPick: (k: string) => void; testid: string }) {
  const [showAll, setShowAll] = useState(false);
  const max = Math.max(1, ...buckets.map((b) => b.n));
  const shown = showAll ? buckets : buckets.slice(0, 12);
  if (buckets.length === 0) return <p className="text-[12.5px] text-ink-500">אין נתונים.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {shown.map((b) => {
        const on = active === b.key;
        return (
          <li key={b.key}>
            <button
              type="button"
              onClick={() => onPick(b.key)}
              aria-pressed={on}
              data-testid={testid}
              data-key={b.key}
              className={cn("w-full text-start rounded-[8px] px-2 py-1 hover:bg-ink-50 transition-colors", on && "bg-tint-purple/60 ring-1 ring-brand-purple/40")}
            >
              <div className="flex items-center gap-2 text-[12.5px]">
                <span className="truncate text-ink-900 font-medium flex-1 min-w-0">{b.key}</span>
                <span className="tabular-nums text-ink-900 font-bold">{b.n}</span>
                <span className="tabular-nums text-ink-500 w-16 text-end">{b.submitted} הגישו</span>
              </div>
              <div className="h-2 rounded-full bg-ink-100 overflow-hidden mt-0.5" aria-hidden>
                <div className="h-full bg-brand-purple/35 rounded-full" style={{ width: `${(b.n / max) * 100}%` }}>
                  <div className="h-full bg-brand-purple rounded-full" style={{ width: b.n ? `${(b.submitted / b.n) * 100}%` : 0 }} />
                </div>
              </div>
            </button>
          </li>
        );
      })}
      {buckets.length > 12 && (
        <li>
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[12px] font-semibold text-brand-purple hover:underline px-2 py-1">
            {showAll ? "להציג פחות" : `עוד ${buckets.length - 12}…`}
          </button>
        </li>
      )}
    </ul>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone: "purple" | "pink" | "gray" }) {
  const cls = { purple: "bg-tint-purple text-brand-purple", pink: "bg-tint-pink text-brand-pink-deep", gray: "bg-ink-50 text-ink-700 border border-ink-200" }[tone];
  return (
    <div className={`rounded-[12px] px-3 py-1.5 min-w-[92px] ${cls}`}>
      <div className="text-[11px] font-semibold opacity-80">{label}</div>
      <div className="font-display text-[20px] font-black leading-tight tabular-nums">
        {value}
        {sub && <span className="text-[11.5px] font-semibold opacity-80 ms-1.5">{sub}</span>}
      </div>
    </div>
  );
}
