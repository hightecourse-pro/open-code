"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { pushArenaToMentors } from "./actions";

export interface ArenaOverviewData {
  open: number;
  stale: number;
  answered: number;
  closed: number;
  medianResponseHours: number | null;
  presentNow: number;
  mentorsTotal: number;
  neverAnswered: { id: string; name: string }[];
  helpfulTotal: number;
}

/** The team's view of the arena (the owner, 16/10): numbers, who never answered, and a push button. */
export function ArenaOverview({ data }: { data: ArenaOverviewData }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="font-display text-base font-bold">זירת המנטוריות</h3>
        <Link href="/arena" className="text-[12.5px] font-bold text-brand-purple hover:underline">
          לזירה ←
        </Link>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center">
        <Stat label="פתוחות" value={data.open} tone={data.open > 0 ? "pink" : "gray"} />
        <Stat label={"מעל 24 שעות"} value={data.stale} tone={data.stale > 0 ? "red" : "gray"} />
        <Stat label="נענו" value={data.answered} />
        <Stat label="נסגרו" value={data.closed} />
        <Stat label="״עזר לי״" value={data.helpfulTotal} tone="mint" />
        <Stat label="זמן תגובה חציוני" value={data.medianResponseHours === null ? "-" : data.medianResponseHours < 1 ? "פחות משעה" : `${data.medianResponseHours} ש׳`} />
        <Stat label="כאן עכשיו" value={`${data.presentNow} / ${data.mentorsTotal}`} tone={data.presentNow > 0 ? "mint" : "gray"} />
      </dl>
      <div className="text-[12.5px] text-ink-700">
        <b>עוד לא ענו אף פעם ({data.neverAnswered.length}):</b>{" "}
        {data.neverAnswered.length === 0 ? "כולן ענו לפחות פעם אחת 🎉" : data.neverAnswered.map((m) => m.name).join(", ")}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (!confirm("לשלוח עכשיו את מייל השאלות הפתוחות לכל המנטוריות הזמינות?")) return;
            setResult(null);
            start(async () => {
              const r = await pushArenaToMentors();
              setResult(r.error ?? r.info ?? "נשלח");
            });
          }}
        >
          {pending ? "שולחת…" : "לדחוף עכשיו לכל המנטוריות"}
        </Button>
        {result && <span className="text-[12.5px] font-semibold text-ink-700">{result}</span>}
        <span className="text-[12px] text-ink-500">המייל היומי רץ לבד בבוקר; ביום ראשון עם המובילות של השבוע לכולן.</span>
      </div>
    </section>
  );
}

function Stat({ label, value, tone = "purple" }: { label: string; value: number | string; tone?: "purple" | "pink" | "red" | "mint" | "gray" }) {
  const cls = { purple: "bg-tint-purple text-brand-purple", pink: "bg-tint-pink text-brand-pink-deep", red: "bg-[#FDE8E8] text-[#B42318]", mint: "bg-tint-mint text-success", gray: "bg-ink-100 text-ink-600" }[tone];
  return (
    <div className={`rounded-[12px] px-2 py-2 ${cls}`}>
      <dt className="text-[11px] font-semibold opacity-80">{label}</dt>
      <dd className="font-display text-[20px] font-black leading-tight">{value}</dd>
    </div>
  );
}
