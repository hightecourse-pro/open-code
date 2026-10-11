import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { VISIT_AREAS, VISIT_RANGES, visitWindow, type VisitArea, type VisitRange } from "@/lib/visits";
import { loadVisitingMembers } from "@/lib/visits-report";

export const metadata: Metadata = { title: "כניסות לאתר" };
export const dynamic = "force-dynamic";

const MAIN: VisitArea[] = ["site", "community", "hackathon", "course"];
const nf = new Intl.NumberFormat("he-IL");
const dayFmt = new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Asia/Jerusalem" });

/**
 * כניסות לאתר (the owner, 11/10): how many came in - to the public site, the
 * community, the hackathon page and the course page. Views, people (anonymous
 * cookie) and members, per range; per day; the most visited pages. Everything
 * is aggregated in the database (page_views_* functions).
 */
export default async function VisitsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireRole("admin");
  const { range: rawRange } = await searchParams;
  const range: VisitRange = VISIT_RANGES.some((r) => r.key === rawRange) ? (rawRange as VisitRange) : "7d";
  const { from, to } = visitWindow(range);
  const args = { p_from: from.toISOString(), p_to: to.toISOString() };
  const admin = createAdminClient();
  const [{ data: summaryRows }, { data: dailyRows }, { data: topRows }, members] = await Promise.all([
    admin.rpc("page_views_summary", args),
    admin.rpc("page_views_daily", args),
    admin.rpc("page_views_top_paths", { ...args, p_limit: 40 }),
    loadVisitingMembers(range),
  ]);
  const summary = new Map((summaryRows ?? []).map((r) => [r.area, { views: Number(r.views), visitors: Number(r.visitors), members: Number(r.members) }]));
  const total = summary.get("*") ?? { views: 0, visitors: 0, members: 0 };

  // Days of the window, Israel time, oldest first, zero-filled.
  const dayKeys: string[] = [];
  const enCa = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
  const firstDay = (dailyRows ?? []).length && range === "all" ? (dailyRows ?? []).map((r) => r.day).sort()[0] : enCa.format(from);
  for (let d = new Date(`${firstDay}T12:00:00Z`); enCa.format(d) <= enCa.format(to); d = new Date(d.getTime() + 86400000)) {
    dayKeys.push(enCa.format(d));
    if (dayKeys.length > 400) break;
  }
  const daily = new Map<string, Record<string, number>>();
  for (const r of dailyRows ?? []) {
    const row = daily.get(r.day) ?? {};
    row[r.area] = Number(r.views);
    daily.set(r.day, row);
  }
  const dayTotal = (k: string) => Object.values(daily.get(k) ?? {}).reduce((a, b) => a + b, 0);
  const maxDay = Math.max(1, ...dayKeys.map(dayTotal));
  const areaMeta = new Map(VISIT_AREAS.map((a) => [a.key, a]));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-bold text-[24px] text-ink-1000">כניסות לאתר</h1>
        <p className="text-[13.5px] text-ink-600 mt-1 leading-relaxed">
          כמה נכנסו - לאתר הציבורי, לקהילה, לדף ההאקתון ולדף הקורס. ״צפיות״ = כל פתיחת דף; ״אנשים״ = דפדפנים שונים (לפי עוגייה
          אנונימית, שנה); ״חברות״ = מי שהיתה מחוברת. רובוטים וזחלנים לא נספרים. הספירה התחילה עם העלאת המנגנון.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {VISIT_RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/visits?range=${r.key}`}
            className={cn(
              "rounded-full px-3 py-1 text-[12.5px] font-semibold border transition-colors",
              range === r.key ? "bg-brand-purple text-white border-brand-purple" : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
            )}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* The headline and the four doors - stat tiles, the number first. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-[16px] border border-ink-200 bg-white px-4 py-3 col-span-2 lg:col-span-1">
          <div className="text-[12px] font-semibold text-ink-600">סה״כ כניסות</div>
          <div className="font-display font-black text-[30px] leading-tight text-ink-1000 tabular-nums">{nf.format(total.views)}</div>
          <div className="text-[12px] text-ink-600 tabular-nums">
            {nf.format(total.visitors)} אנשים · {nf.format(total.members)} חברות
          </div>
        </div>
        {MAIN.map((key) => {
          const a = areaMeta.get(key)!;
          const s = summary.get(key) ?? { views: 0, visitors: 0, members: 0 };
          return (
            <div key={key} className="rounded-[16px] border border-ink-200 bg-white px-4 py-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-700">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: a.color }} aria-hidden />
                {a.label}
              </div>
              <div className="font-display font-black text-[26px] leading-tight text-ink-1000 tabular-nums">{nf.format(s.views)}</div>
              <div className="text-[12px] text-ink-600 tabular-nums">
                {nf.format(s.visitors)} אנשים{key === "community" ? ` · ${nf.format(s.members)} חברות` : ""}
              </div>
              <div className="text-[11px] text-ink-400 mt-0.5">{a.hint}</div>
            </div>
          );
        })}
      </div>
      {(summary.get("portal")?.views || summary.get("coordinator")?.views) ? (
        <p className="text-[12.5px] text-ink-600 -mt-2">
          בנוסף: פורטל מעסיקים {nf.format(summary.get("portal")?.views ?? 0)} · רכזות מוסדות {nf.format(summary.get("coordinator")?.views ?? 0)} (נכללים בסה״כ).
        </p>
      ) : null}

      {/* Per day - one thin stacked bar a day, the four doors in fixed colours. */}
      <section className="rounded-[16px] border border-ink-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-display font-bold text-[16px] text-ink-1000">לפי יום</h2>
          <div className="flex items-center gap-3 flex-wrap text-[11.5px] text-ink-700">
            {MAIN.map((key) => (
              <span key={key} className="inline-flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: areaMeta.get(key)!.color }} aria-hidden />
                {areaMeta.get(key)!.label}
              </span>
            ))}
          </div>
        </div>
        {dayKeys.length === 0 || total.views === 0 ? (
          <p className="text-[13px] text-ink-500 mt-2">עדיין אין כניסות בטווח הזה.</p>
        ) : (
          <table className="w-full text-[12.5px] mt-2">
            <thead className="text-ink-500 text-[11.5px]">
              <tr>
                <th className="text-start font-semibold py-1 w-24">יום</th>
                <th className="text-start font-semibold py-1 w-16">צפיות</th>
                <th className="text-start font-semibold py-1">פילוח</th>
              </tr>
            </thead>
            <tbody>
              {[...dayKeys].reverse().map((k) => {
                const row = daily.get(k) ?? {};
                const t = dayTotal(k);
                const tip = MAIN.map((a) => `${areaMeta.get(a)!.label}: ${row[a] ?? 0}`).join(" · ");
                return (
                  <tr key={k} className="border-t border-ink-100">
                    <td className="py-1.5 text-ink-700 whitespace-nowrap">{dayFmt.format(new Date(`${k}T12:00:00Z`))}</td>
                    <td className="py-1.5 font-semibold text-ink-1000 tabular-nums">{nf.format(t)}</td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-[2px] h-[10px]" style={{ width: `${Math.max(1, Math.round((t / maxDay) * 100))}%` }} title={tip} aria-label={tip}>
                        {MAIN.map((a) =>
                          row[a] ? (
                            <span key={a} className="block h-full rounded-[4px]" style={{ background: areaMeta.get(a)!.color, flex: `${row[a]} 0 0` }} />
                          ) : null
                        )}
                        {Object.keys(row).some((a) => !MAIN.includes(a as VisitArea)) && (
                          <span className="block h-full rounded-[4px] bg-ink-300" style={{ flex: `${Object.entries(row).filter(([a]) => !MAIN.includes(a as VisitArea)).reduce((s, [, v]) => s + v, 0)} 0 0` }} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Who came in - members by name, with the CSV the owner asked for (11/10). */}
      <section className="rounded-[16px] border border-ink-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display font-bold text-[16px] text-ink-1000">מי נכנסה - חברות ({nf.format(members.length)})</h2>
            <p className="text-[12px] text-ink-500">חברות מחוברות בלבד; מבקרות אנונימיות נמצאות בסה״כ למעלה. הדוח המלא עם שם ומייל - בייצוא.</p>
          </div>
          <a
            href={`/admin/visits/export?range=${range}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-purple bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-purple hover:bg-tint-purple"
          >
            ⬇ ייצוא דוח כניסות (CSV, {VISIT_RANGES.find((r) => r.key === range)?.label})
          </a>
        </div>
        {members.length === 0 ? (
          <p className="text-[13px] text-ink-500 mt-2">אין כניסות של חברות בטווח הזה.</p>
        ) : (
          <table className="w-full text-[12.5px] mt-2">
            <thead className="text-ink-500 text-[11.5px]">
              <tr>
                <th className="text-start font-semibold py-1">שם</th>
                <th className="text-start font-semibold py-1">מייל</th>
                <th className="text-start font-semibold py-1 w-16">כניסות</th>
                <th className="text-start font-semibold py-1 w-32">אחרונה</th>
                <th className="text-start font-semibold py-1">אזורים</th>
              </tr>
            </thead>
            <tbody>
              {members.slice(0, 25).map((m) => (
                <tr key={m.profileId} className="border-t border-ink-100">
                  <td className="py-1.5 font-semibold text-ink-1000">
                    <Link href={`/admin/members/${m.profileId}`} className="hover:underline text-brand-purple">
                      {m.name}
                    </Link>
                    {m.subscriber && <span className="ms-1.5 text-[10.5px] text-green-800 bg-tint-green rounded-full px-1.5 py-0.5">מנויה</span>}
                  </td>
                  <td className="py-1.5 text-ink-700" dir="ltr" style={{ textAlign: "start" }}>
                    {m.email}
                  </td>
                  <td className="py-1.5 font-semibold tabular-nums">{nf.format(m.views)}</td>
                  <td className="py-1.5 text-ink-700 whitespace-nowrap">{dayFmt.format(new Date(m.lastAt))}</td>
                  <td className="py-1.5 text-ink-700">{m.areas.map((a) => areaMeta.get(a)?.label ?? a).join(" / ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {members.length > 25 && <p className="text-[12px] text-ink-500 mt-1">מוצגות 25 הראשונות לפי כניסות; כולן בייצוא.</p>}
      </section>

      {/* The most visited pages. */}
      <section className="rounded-[16px] border border-ink-200 bg-white px-4 py-3">
        <h2 className="font-display font-bold text-[16px] text-ink-1000">הדפים הכי נצפים</h2>
        {(topRows ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-500 mt-2">עדיין אין נתונים.</p>
        ) : (
          <table className="w-full text-[12.5px] mt-2">
            <thead className="text-ink-500 text-[11.5px]">
              <tr>
                <th className="text-start font-semibold py-1">דף</th>
                <th className="text-start font-semibold py-1 w-28">אזור</th>
                <th className="text-start font-semibold py-1 w-16">צפיות</th>
                <th className="text-start font-semibold py-1 w-16">אנשים</th>
              </tr>
            </thead>
            <tbody>
              {(topRows ?? []).slice(0, 25).map((r) => (
                <tr key={`${r.area}:${r.path}`} className="border-t border-ink-100">
                  <td className="py-1.5 font-mono text-[12px] text-ink-900" dir="ltr" style={{ textAlign: "start" }}>
                    {r.path}
                  </td>
                  <td className="py-1.5 text-ink-700">
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: areaMeta.get(r.area as VisitArea)?.color ?? "#9CA3AF" }} aria-hidden />
                      {areaMeta.get(r.area as VisitArea)?.label ?? r.area}
                    </span>
                  </td>
                  <td className="py-1.5 font-semibold tabular-nums">{nf.format(Number(r.views))}</td>
                  <td className="py-1.5 tabular-nums text-ink-700">{nf.format(Number(r.visitors))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
