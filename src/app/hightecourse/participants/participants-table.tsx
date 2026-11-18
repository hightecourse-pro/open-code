"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { H } from "../../ai-course/theme";
import { TRACKS } from "../config";
import type { Participant } from "../data";
import { Freshness } from "../gate";
import { Card, ExtLink, fmtNum } from "../ui";

/*
  The participants table: free search over every field, four filters, the
  first 150 matches rendered and more on demand (the admin members screen
  taught us not to render thousands of rows at once), and a row that opens to
  the whole sheet row.
*/
const PAGE = 150;

const selectCls = "bg-white px-3 py-2 text-[13.5px] outline-none";
const selectStyle = { border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink, maxWidth: "100%" } as const;

function Select({ label, value, onChange, options, testId }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; label: string }[]; testId: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[12.5px] font-bold" style={{ color: H.navy }}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls} style={selectStyle} data-testid={testId}>
        <option value="">הכל</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TrackDot({ p }: { p: Participant }) {
  const t = TRACKS.find((x) => x.key === p.track)!;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0" style={{ background: t.color, borderRadius: 3 }} />
      {p.trackLabel || "-"}
    </span>
  );
}

/** The dashboard's names panel links here with ?rows=2,5,9 (sheet rows) - ״N מתוך M״ with the usual ״לנקות סינון״. */
export function ParticipantsTable({ rows, courses, companies, fetchedAt, sheetUrl, initial }: { rows: Participant[]; courses: string[]; companies: string[]; fetchedAt: string; sheetUrl: string; initial: { course: string; track: string; company: string; q: string; rows: number[] } }) {
  const [q, setQ] = useState(initial.q);
  const dq = useDeferredValue(q);
  const [course, setCourse] = useState(initial.course);
  const [track, setTrack] = useState(initial.track);
  const [company, setCompany] = useState(initial.company);
  const [lodging, setLodging] = useState("");
  const [picked, setPicked] = useState<Set<number> | null>(initial.rows.length ? new Set(initial.rows) : null);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const needle = dq.trim().toLowerCase();
    return rows.filter((p) => {
      if (picked && !picked.has(p.row)) return false;
      if (course && p.course !== course) return false;
      if (track && p.track !== track) return false;
      if (company && p.company !== company) return false;
      if (lodging === "yes" && !("lodging" in p.items)) return false;
      if (lodging === "no" && "lodging" in p.items) return false;
      if (needle && !p.fields.some((f) => f.v.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [rows, dq, course, track, company, lodging, picked]);

  const shown = filtered.slice(0, limit);
  const th = "px-3 py-2 text-start text-[12.5px] font-bold whitespace-nowrap";
  const td = "px-3 py-2 text-[13.5px] align-top";
  const clearAll = () => {
    setQ("");
    setCourse("");
    setTrack("");
    setCompany("");
    setLodging("");
    setPicked(null);
    setLimit(PAGE);
  };
  const anyFilter = q || course || track || company || lodging || picked;

  return (
    <div className="space-y-4" data-testid="hc-participants">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-[24px] font-black leading-tight" style={{ color: H.navy }}>
            משתתפות
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: H.muted }}>
            הגליון ״משתתפות״ · <ExtLink href={sheetUrl}>לפתיחה בגוגל שיטס</ExtLink>
          </p>
        </div>
        <Freshness fetchedAt={fetchedAt} />
      </div>

      <Card className="px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
          <label className="flex min-w-0 flex-col gap-1 text-[12.5px] font-bold" style={{ color: H.navy }}>
            חיפוש
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="שם, מייל, טלפון, חברה, הערה..."
              className="bg-white px-3 py-2 text-[14px] outline-none"
              style={{ border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink }}
              data-testid="hc-search"
            />
          </label>
          <Select label="קורס" value={course} onChange={(v) => { setCourse(v); setLimit(PAGE); }} options={courses.map((c) => ({ v: c, label: c }))} testId="hc-filter-course" />
          <Select label="מסלול" value={track} onChange={(v) => { setTrack(v); setLimit(PAGE); }} options={TRACKS.filter((t) => t.key !== "other").map((t) => ({ v: t.key, label: t.label }))} testId="hc-filter-track" />
          <Select label="חברה" value={company} onChange={(v) => { setCompany(v); setLimit(PAGE); }} options={companies.map((c) => ({ v: c, label: c }))} testId="hc-filter-company" />
          <Select label="לינה" value={lodging} onChange={(v) => { setLodging(v); setLimit(PAGE); }} options={[{ v: "yes", label: "עם לינה" }, { v: "no", label: "בלי לינה" }]} testId="hc-filter-lodging" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" style={{ color: H.muted }}>
          <span data-testid="hc-count">{filtered.length === rows.length ? `${fmtNum.format(rows.length)} משתתפות` : `${fmtNum.format(filtered.length)} מתוך ${fmtNum.format(rows.length)}`}</span>
          {picked && (
            <span className="px-2 py-0.5 text-[12px] font-bold" style={{ background: H.yellowSoft, color: H.navyDeep, borderRadius: 999 }} data-testid="hc-picked">
              רשימה מהדשבורד
            </span>
          )}
          {anyFilter && (
            <button type="button" onClick={clearAll} className="font-bold underline underline-offset-2" style={{ color: H.navy }} data-testid="hc-clear">
              לנקות סינון
            </button>
          )}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="hc-table">
            <thead>
              <tr style={{ background: H.row, color: H.navy }}>
                <th className={th}>מס</th>
                <th className={th}>שם</th>
                <th className={th}>חברה</th>
                <th className={th}>קורס</th>
                <th className={th}>מסלול</th>
                <th className={th}>לינה</th>
                <th className={th}>תפקיד</th>
                <th className={th}>נייד</th>
                <th className={th}>מייל</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const isOpen = open === p.row;
                return [
                  <tr key={p.row} onClick={() => setOpen(isOpen ? null : p.row)} className="cursor-pointer" style={{ borderBottom: `1px solid ${H.line}`, background: isOpen ? H.yellowSoft : undefined }} data-testid="hc-row" aria-expanded={isOpen}>
                    <td className={`${td} tabular-nums`} style={{ color: H.muted }}>
                      {p.num}
                    </td>
                    <td className={`${td} whitespace-nowrap font-bold`} style={{ color: H.ink }}>
                      {p.name}
                    </td>
                    <td className={`${td} max-w-[220px] truncate`} style={{ color: H.ink }} title={p.company}>
                      {p.company}
                    </td>
                    <td className={`${td} max-w-[260px]`} style={{ color: H.ink }}>
                      {p.course}
                    </td>
                    <td className={td} style={{ color: H.ink }}>
                      <TrackDot p={p} />
                    </td>
                    <td className={td} style={{ color: "lodging" in p.items ? H.green : H.muted }}>
                      {"lodging" in p.items ? "כן" : "לא"}
                    </td>
                    <td className={`${td} max-w-[180px] truncate`} style={{ color: H.muted }} title={p.role}>
                      {p.role}
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums`} dir="ltr" style={{ color: H.ink, textAlign: "right" }}>
                      {p.phone}
                    </td>
                    <td className={`${td} whitespace-nowrap`} dir="ltr" style={{ color: H.ink, textAlign: "right" }}>
                      {p.mail}
                    </td>
                  </tr>,
                  isOpen ? (
                    <tr key={`${p.row}-d`} style={{ borderBottom: `1px solid ${H.line}` }} data-testid="hc-row-detail">
                      <td colSpan={9} className="px-4 py-3" style={{ background: "#FFFBEA" }}>
                        <div className="mb-2 text-[12.5px]" style={{ color: H.muted }}>
                          שורה {p.row} בגיליון
                        </div>
                        <dl className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                          {p.fields.map((f) => (
                            <div key={f.k} className="flex gap-2">
                              <dt className="shrink-0 font-bold" style={{ color: H.navy }}>
                                {f.k}:
                              </dt>
                              <dd className="min-w-0 break-words" style={{ color: H.ink }}>
                                {f.v}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="px-5 py-6 text-center text-[14px]" style={{ color: H.muted }} data-testid="hc-empty">
            אין משתתפות שמתאימות לסינון.
          </p>
        )}
        {filtered.length > shown.length && (
          <div className="px-5 py-4 text-center">
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="px-5 py-2 text-[14px] font-bold" style={{ border: `1.5px solid ${H.navy}`, color: H.navy, borderRadius: 999, background: H.white }} data-testid="hc-more">
              להציג עוד ({fmtNum.format(filtered.length - shown.length)} נוספות)
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
