"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { H } from "../ai-course/theme";
import { PATHS, TRACKS } from "./config";
import type { CourseCount, Snapshot } from "./data";
import { Freshness } from "./gate";
import { Card, CardTitle, ExtLink, Notice, Stat, fmtNum } from "./ui";

/*
  The dashboard screen. The chart is HTML: one row per course, a thin bar
  stacked by registration track (navy = frontal, light blue = frontal with
  lodging, yellow = digital), the total at its end, a hover tooltip per
  segment, and a table view of the same numbers. Colours follow the track,
  never the rank, so a filter elsewhere never repaints a course.
*/
function Legend({ tracks }: { tracks: Snapshot["tracks"] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 px-5 pb-3 text-[13px]" aria-label="מקרא" data-testid="hc-legend">
      {tracks.map((t) => (
        <li key={t.key} className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-3 w-3" style={{ background: t.color, borderRadius: 3 }} />
          <span style={{ color: H.ink }}>{t.label}</span>
          <span className="tabular-nums" style={{ color: H.muted }}>
            {fmtNum.format(t.count)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CourseBars({ courses, max }: { courses: CourseCount[]; max: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const show = (e: React.MouseEvent<HTMLElement>, text: string) => {
    const host = box.current?.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    if (!host) return;
    setTip({ text, x: r.left + r.width / 2 - host.left, y: r.top - host.top });
  };
  return (
    <div ref={box} className="relative">
      <ol className="space-y-2 px-5 pb-5" data-testid="hc-course-bars">
        {courses.map((c) => {
          const segs = TRACKS.map((t) => ({ t, n: c.byTrack[t.key] })).filter((s) => s.n > 0);
          return (
            <li key={c.course} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(170px,36%)_minmax(0,1fr)_3.25rem]" data-testid="hc-course-row">
              <div className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] font-bold leading-snug sm:col-span-1" style={{ color: H.ink }}>
                <Link href={`${PATHS.participants}?course=${encodeURIComponent(c.course)}`} className="hover:underline" style={{ color: H.ink }} data-testid="hc-course-name">
                  {c.course}
                </Link>
                {c.category && (
                  <span className="whitespace-nowrap px-1.5 py-px text-[11px] font-bold" style={{ background: H.row, color: H.muted, borderRadius: 999 }}>
                    {c.category}
                  </span>
                )}
              </div>
              <div className="flex h-[18px] items-center gap-[2px]" role="img" aria-label={`${c.course}: ${c.total} משתתפות`}>
                {segs.map((s, i) => {
                  const w = (s.n / max) * 100;
                  const radius = `${i === 0 ? 4 : 0}px ${i === segs.length - 1 ? 4 : 0}px ${i === segs.length - 1 ? 4 : 0}px ${i === 0 ? 4 : 0}px`;
                  return (
                    <div
                      key={s.t.key}
                      className="flex h-full items-center justify-center overflow-hidden text-[11px] font-bold"
                      style={{ width: `${w}%`, minWidth: 3, background: s.t.color, borderRadius: radius, color: s.t.key === "digital" ? H.navyDeep : H.white }}
                      title={`${s.t.label}: ${s.n}`}
                      onMouseEnter={(e) => show(e, `${c.course} · ${s.t.label}: ${s.n}`)}
                      onMouseLeave={() => setTip(null)}
                      data-testid="hc-seg"
                      data-track={s.t.key}
                    >
                      {w >= 9 ? s.n : ""}
                    </div>
                  );
                })}
              </div>
              <div className="text-[15px] font-black tabular-nums" style={{ color: H.navy }} data-testid="hc-course-total">
                {c.total}
              </div>
            </li>
          );
        })}
      </ol>
      {tip && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap px-2.5 py-1.5 text-[12.5px] font-bold text-white" style={{ left: tip.x, top: tip.y - 6, background: H.navyDeep, borderRadius: 8 }} role="status">
          {tip.text}
        </div>
      )}
    </div>
  );
}

function CourseTable({ courses, tracks }: { courses: CourseCount[]; tracks: Snapshot["tracks"] }) {
  const th = "px-3 py-2 text-start text-[12.5px] font-bold whitespace-nowrap";
  const td = "px-3 py-2 text-[13.5px] tabular-nums";
  return (
    <div className="overflow-x-auto px-5 pb-5">
      <table className="w-full" data-testid="hc-course-table">
        <thead>
          <tr style={{ background: H.row, color: H.navy }}>
            <th className={th} style={{ borderRadius: "0 8px 8px 0" }}>
              קורס
            </th>
            <th className={th}>סה״כ</th>
            {tracks.map((t) => (
              <th key={t.key} className={th}>
                {t.label}
              </th>
            ))}
            <th className={th} style={{ borderRadius: "8px 0 0 8px" }}>
              קטגוריה
            </th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => (
            <tr key={c.course} style={{ borderBottom: `1px solid ${H.line}` }}>
              <td className={`${td} font-bold`} style={{ color: H.ink }}>
                {c.course}
              </td>
              <td className={`${td} font-black`} style={{ color: H.navy }}>
                {c.total}
              </td>
              {tracks.map((t) => (
                <td key={t.key} className={td} style={{ color: c.byTrack[t.key] ? H.ink : H.line }}>
                  {c.byTrack[t.key] || "-"}
                </td>
              ))}
              <td className={td} style={{ color: H.muted }}>
                {c.category || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountList({ items, hrefOf, testId }: { items: { label: string; count: number }[]; hrefOf?: (label: string) => string; testId?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ol className="space-y-1.5 px-5 pb-5" data-testid={testId}>
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-3 text-[13.5px]">
          <div className="flex items-center gap-2">
            {hrefOf ? (
              <Link href={hrefOf(i.label)} className="truncate font-medium hover:underline" style={{ color: H.ink }} title={i.label}>
                {i.label}
              </Link>
            ) : (
              <span className="truncate font-medium" style={{ color: H.ink }} title={i.label}>
                {i.label}
              </span>
            )}
            <span aria-hidden className="h-[6px] shrink-0" style={{ width: `${Math.max(2, (i.count / max) * 90)}px`, background: H.navy, opacity: 0.55, borderRadius: 3 }} />
          </div>
          <span className="text-end font-black tabular-nums" style={{ color: H.navy }}>
            {i.count}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Dashboard({ snap, error, sheetUrl }: { snap: Snapshot | null; error: string; sheetUrl: string }) {
  const [view, setView] = useState<"bars" | "table">("bars");
  if (!snap) {
    return (
      <div className="space-y-4" data-testid="hc-dashboard-error">
        <h1 className="text-[22px] font-black" style={{ color: H.navy }}>
          דשבורד
        </h1>
        <Notice tone="error">{error || "הקריאה מהגיליון נכשלה."}</Notice>
        <Freshness fetchedAt={new Date().toISOString()} />
      </div>
    );
  }
  const { counts, tracks } = snap;
  const max = Math.max(1, ...snap.courses.map((c) => c.total));
  const otherTrack = tracks.find((t) => t.key === "other");
  const pill = (v: "bars" | "table", label: string) => (
    <button type="button" onClick={() => setView(v)} className="px-3 py-1 text-[13px] font-bold" style={{ background: view === v ? H.navy : H.white, color: view === v ? H.white : H.navy, border: `1.5px solid ${H.navy}`, borderRadius: 999 }} aria-pressed={view === v} data-testid={`hc-view-${v}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-5" data-testid="hc-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-[24px] font-black leading-tight" style={{ color: H.navy }}>
            דשבורד
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: H.muted }}>
            מהגיליון ״{snap.sheetTitle}״ · <ExtLink href={sheetUrl}>לפתיחה בגוגל שיטס</ExtLink>
          </p>
        </div>
        <Freshness fetchedAt={snap.fetchedAt} />
      </div>

      {snap.missingTabs.length > 0 && (
        <Notice testId="hc-missing-tabs">
          גליונות שהדשבורד מצפה להם ולא נמצאו בגיליון: {snap.missingTabs.map((t) => `״${t}״`).join(", ")}. אם שינית להם שם - תגידי לי ואעדכן.
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="hc-stats">
        <Stat label="משתתפות" value={fmtNum.format(counts.participants)} sub="בגליון ״משתתפות״" highlight testId="hc-stat-participants" />
        {tracks
          .filter((t) => t.key !== "other")
          .map((t) => (
            <Stat key={t.key} label={t.label} value={fmtNum.format(t.count)} testId={`hc-stat-${t.key}`} />
          ))}
        {otherTrack && <Stat label="מסלול אחר" value={fmtNum.format(otherTrack.count)} sub="ערך שאינו אחד משלושת המסלולים" testId="hc-stat-other" />}
        <Stat label="לינה" value={fmtNum.format(counts.lodging)} sub={counts.privateRoom ? `מתוכן ${counts.privateRoom} בחדר פרטי` : undefined} testId="hc-stat-lodging" />
        <Stat label="חברות" value={fmtNum.format(counts.companies)} sub="ששלחו משתתפות" testId="hc-stat-companies" />
        <Stat label="ביטולים" value={fmtNum.format(counts.cancellations)} testId="hc-stat-cancellations" />
        <Stat label="יום שלישי" value={fmtNum.format(counts.day3)} sub="נרשמות בגליון ״יום שלישי״" testId="hc-stat-day3" />
        <Stat label="צוות ומרצים" value={fmtNum.format(counts.staff)} testId="hc-stat-staff" />
        <Stat label="תינוקות" value={fmtNum.format(counts.babies)} sub="משתתפות שבאות עם תינוק" testId="hc-stat-babies" />
        <Stat label="השכרת מחשב נייד" value={fmtNum.format(counts.laptopRentals)} testId="hc-stat-laptops" />
      </div>

      <Card testId="hc-courses">
        <CardTitle
          aside={
            <div className="flex items-center gap-2">
              {pill("bars", "תרשים")}
              {pill("table", "טבלה")}
            </div>
          }
        >
          משתתפות בכל קורס
        </CardTitle>
        <p className="px-5 pb-3 text-[13px]" style={{ color: H.muted }}>
          {snap.courses.length} קורסים · לפי העמודה ״קורס״ · לחיצה על שם קורס פותחת את הרשימה שלו
        </p>
        <Legend tracks={tracks} />
        {view === "bars" ? <CourseBars courses={snap.courses} max={max} /> : <CourseTable courses={snap.courses} tracks={tracks} />}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card testId="hc-companies">
          <CardTitle aside={<span className="text-[12.5px]" style={{ color: H.muted }}>{counts.companies} חברות</span>}>החברות ששלחו הכי הרבה</CardTitle>
          <CountList items={snap.companies.slice(0, 12).map((c) => ({ label: c.company, count: c.count }))} hrefOf={(c) => `${PATHS.participants}?company=${encodeURIComponent(c)}`} testId="hc-company-list" />
        </Card>
        <Card testId="hc-extra-courses">
          <CardTitle>בחירות נוספות</CardTitle>
          <div className="px-5 pb-1 text-[13px] font-bold" style={{ color: H.navy }}>
            קורס דיגיטלי ({snap.digitalCourses.reduce((s, x) => s + x.count, 0)})
          </div>
          {snap.digitalCourses.length ? <CountList items={snap.digitalCourses.slice(0, 8).map((c) => ({ label: c.course, count: c.count }))} /> : <p className="px-5 pb-4 text-[13px]" style={{ color: H.muted }}>אין</p>}
          <div className="px-5 pb-1 text-[13px] font-bold" style={{ color: H.navy }}>
            קורס לתעודה ({snap.certCourses.reduce((s, x) => s + x.count, 0)})
          </div>
          {snap.certCourses.length ? <CountList items={snap.certCourses.slice(0, 8).map((c) => ({ label: c.course, count: c.count }))} /> : <p className="px-5 pb-4 text-[13px]" style={{ color: H.muted }}>אין</p>}
        </Card>
      </div>
    </div>
  );
}
