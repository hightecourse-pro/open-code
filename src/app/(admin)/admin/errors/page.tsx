import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAppErrors } from "@/lib/error-log";

export const metadata: Metadata = { title: "שגיאות אחרונות" };
export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jerusalem" });

/**
 * שגיאות אחרונות (26/10): the last sixty crashes the app caught - a server
 * page that threw (with its real message and stack) or a browser-side crash
 * the error screen reported - newest first, with who hit it and where.
 */
export default async function AdminErrorsPage() {
  await requireRole("admin");
  const items = await readAppErrors();
  const ids = [...new Set(items.map((i) => i.profileId).filter((x): x is string => !!x))];
  const nameOf = new Map<string, string>();
  if (ids.length) {
    const { data } = await createAdminClient().from("profiles").select("id, full_name").in("id", ids);
    for (const p of data ?? []) nameOf.set(p.id, p.full_name);
  }
  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;שגיאות/&gt;</span>
        <h1 className="font-display text-[26px] font-black text-ink-1000 mt-1">שגיאות אחרונות</h1>
        <p className="t-body-sm text-ink-700 mt-1">מה המערכת תפסה כשמישהי ראתה ״משהו השתבש רגע״: איפה, מתי, למי, ולמה. החדשה ביותר למעלה.</p>
      </div>
      {items.length === 0 ? (
        <p className="bg-white border border-ink-200 rounded-[18px] p-5 text-ink-500 text-sm shadow-sm" data-testid="errors-empty">
          לא נתפסו שגיאות.
        </p>
      ) : (
        <div className="flex flex-col gap-3" data-testid="errors-list">
          {items.map((it, i) => (
            <article key={`${it.at}-${i}`} className="bg-white border border-ink-200 rounded-[16px] shadow-sm px-4 py-3 text-[13px]" data-testid="error-item" data-kind={it.kind}>
              <div className="flex items-center gap-2 flex-wrap text-[12px] text-ink-600">
                <b className="text-ink-900">{WHEN.format(new Date(it.at))}</b>
                <span className={it.kind === "server" ? "rounded-full bg-[#FDE8E8] text-[#B42318] px-2 py-0.5 font-semibold" : "rounded-full bg-tint-warm text-[#8C5E0E] px-2 py-0.5 font-semibold"}>
                  {it.kind === "server" ? "שרת" : "דפדפן"}
                </span>
                <span dir="ltr" className="font-mono">{it.where}</span>
                {it.profileId && <span>· {nameOf.get(it.profileId) ?? it.profileId.slice(0, 8)}</span>}
                {it.digest && (
                  <span dir="ltr" className="font-mono text-ink-400">
                    {it.digest}
                  </span>
                )}
              </div>
              <div dir="ltr" className="mt-1.5 font-mono text-[12.5px] text-ink-900 whitespace-pre-wrap break-words text-left">
                {it.message}
              </div>
              {it.stack && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[12px] text-ink-500">המחסנית</summary>
                  <pre dir="ltr" className="mt-1 text-[11px] leading-snug text-ink-700 whitespace-pre-wrap break-words text-left bg-ink-50 rounded-[10px] p-2.5 overflow-x-auto">
                    {it.stack}
                  </pre>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
