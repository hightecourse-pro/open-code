import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listSystemKeys } from "@/lib/ai/system-keys";
import { AddSystemKeyForm, SystemKeyCard, type UsageDay } from "./keys-manager";

export const metadata: Metadata = { title: "מפתחות AI" };

const WINDOW_DAYS = 7;

// bump_ai_key_usage stamps rows with the database's current_date (UTC), so the
// window is built in UTC too — otherwise "today" could land on the wrong bar.
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The last 7 calendar days, oldest → newest. */
function usageWindow(): { day: string; weekday: string; label: string; isToday: boolean }[] {
  const weekdayFmt = new Intl.DateTimeFormat("he-IL", { weekday: "narrow", timeZone: "UTC" });
  const labelFmt = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  });
  const today = utcDayKey(new Date());

  return Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const d = new Date(Date.now() - (WINDOW_DAYS - 1 - i) * 86400000);
    const day = utcDayKey(d);
    return {
      day,
      weekday: weekdayFmt.format(d),
      label: labelFmt.format(d),
      isToday: day === today,
    };
  });
}

export default async function AdminAiKeysPage() {
  await requireRole("admin");

  const keys = await listSystemKeys(WINDOW_DAYS);
  const dayWindow = usageWindow();

  const cards = keys.map((k) => {
    // listSystemKeys only returns days that saw traffic; fill the gaps so every
    // key shows a full 7-bar strip and quiet days read as zero, not as missing.
    const byDay = new Map(k.usage.map((u) => [u.day, u]));
    const days: UsageDay[] = dayWindow.map((w) => ({
      ...w,
      calls: byDay.get(w.day)?.calls ?? 0,
      errors: byDay.get(w.day)?.errors ?? 0,
    }));
    return {
      id: k.id,
      label: k.label,
      key_last4: k.key_last4,
      status: k.status,
      last_error: k.last_error,
      last_used_at: k.last_used_at,
      days,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מפתחות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">מפתחות AI</h1>
        <p className="text-[13px] text-ink-500 mt-1.5">
          המפתחות האלה מפעילים את החיפוש החכם בפורטל המעסיקים — המפתחות האישיים של החברות
          נפרדים לגמרי ואינם מושפעים מכאן.
        </p>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">הוספת מפתח לבריכה</h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          כשמפתח אחד מגיע למכסה היומית, החיפוש עובר אוטומטית למפתח הבא.
        </p>
        <AddSystemKeyForm />
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">בריכת המפתחות ({cards.length})</h3>

        {cards.length > 0 ? (
          <div className="flex flex-col gap-3">
            {cards.map((k) => (
              <SystemKeyCard key={k.id} keyData={k} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <KeyRound size={28} className="text-ink-300" />
            <p className="text-ink-500 text-sm">
              אין עדיין מפתחות בבריכה — החיפוש החכם בפורטל לא יעבוד בלעדיהם.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
