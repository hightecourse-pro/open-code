"use client";

import { useRouter } from "next/navigation";

/**
 * The owner looks through a particular judge's eyes (27/10: "שגם אני אראה
 * כמוה, שאראה מה היא רואה"): her challenges, and the AI's exam only when it
 * was opened to her. "שופטת" is the plain judge's view - no review at all.
 */
export function PreviewAs({ judges, current }: { judges: { id: string; name: string; seesReport: boolean }[]; current: string }) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-800">
      כמו:
      <select
        value={current}
        onChange={(e) => router.push(e.target.value === "judge" ? "/judge" : `/judge?as=${encodeURIComponent(e.target.value)}`)}
        className="text-[12.5px] font-semibold border border-ink-300 rounded-md px-2 py-1 bg-white outline-none focus:border-brand-purple max-w-[260px]"
        data-testid="judge-preview-as"
      >
        <option value="judge">שופטת בלי הבחינה של ה-AI</option>
        {judges.map((j) => (
          <option key={j.id} value={j.id}>
            {j.name}
            {j.seesReport ? " · עם הבחינה של ה-AI" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
