"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { H } from "../ai-course/theme";
import { PAID_ITEMS, PATHS, TRACKS, isFrontal, type DashRow, type NameRow, type PaidKey, type TrackKey } from "./config";
import { Freshness } from "./gate";
import { Card, ExtLink, Notice, fmtNum } from "./ui";

/*
  The interactive dashboard (the owner, 18/11: ״הדשבורד צריך להיות אינטרקטיבי -
  בלחיצה לראות את השמות הרלוונטיים… תחלק לגמרי את הרשימות של דיגיטלי ופרונטלי…
  כל מי שבלינה בנפרד מהקורס… תסמן לי כמה בחרו לינה ולא כתוב ששולם - כך בכל
  סעיפי התשלום… דשבורד לפי חברות״).

  Every count on the page is a button that opens the names behind it in a
  side panel; the panel links to the full table (filtered to those rows) and
  copies the list. Charts are HTML: thin bars stacked by a fixed colour per
  track, a 2px gap between segments, the total at the bar's end, a table view
  of the same numbers. Colours follow the track, never the rank.
*/

export interface DashboardData {
  sheetTitle: string;
  fetchedAt: string;
  rows: DashRow[];
  categoryByCourse: Record<string, string>;
  extras: { cancellations: NameRow[]; day3: NameRow[]; staff: NameRow[] };
  missingTabs: string[];
}

const trackOf = (key: TrackKey) => TRACKS.find((t) => t.key === key) ?? TRACKS[3];
const AMBER = { ink: "#9A5B00", bg: "#FFF1D6", line: "#F2C66D" };

/* ---- the names panel ---- */

interface Person {
  row: number;
  name: string;
  line: string;
  phone?: string;
  track?: TrackKey;
  flag?: string;
}
interface Panel {
  title: string;
  sub?: string;
  people: Person[];
  /** participants' sheet rows - the link into the full table */
  rows?: number[];
}

const personOf = (r: DashRow, flag?: string): Person => ({ row: r.row, name: r.name, line: [r.company, r.course].filter(Boolean).join(" · "), phone: r.phone, track: r.track, flag });
const panelOf = (title: string, list: DashRow[], sub?: string, flagOf?: (r: DashRow) => string | undefined): Panel => ({
  title,
  sub,
  people: list.map((r) => personOf(r, flagOf?.(r))),
  rows: list.map((r) => r.row),
});

function NamesPanel({ panel, onClose }: { panel: Panel; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const copy = async () => {
    const text = panel.people.map((p) => [p.name, p.line, p.phone].filter(Boolean).join(" · ")).join("\n");
    try {
      await navigator.clipboard.writeText(`${panel.title} (${panel.people.length})\n${text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no clipboard - the list stays on screen */
    }
  };
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={panel.title} data-testid="hc-panel">
      <button type="button" aria-label="סגירה" onClick={onClose} className="absolute inset-0" style={{ background: "rgba(28,43,58,.45)" }} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col bg-white shadow-2xl" style={{ borderInlineStart: `4px solid ${H.yellow}` }}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${H.line}` }}>
          <div className="min-w-0">
            <h2 className="text-[18px] font-black leading-snug" style={{ color: H.navy }} data-testid="hc-panel-title">
              {panel.title}
            </h2>
            <div className="mt-0.5 text-[13px]" style={{ color: H.muted }}>
              <span className="font-black tabular-nums" style={{ color: H.ink }} data-testid="hc-panel-count">
                {fmtNum.format(panel.people.length)}
              </span>{" "}
              {panel.people.length === 1 ? "שם" : "שמות"}
              {panel.sub ? ` · ${panel.sub}` : ""}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="shrink-0 px-2 text-[22px] leading-none" style={{ color: H.muted }} data-testid="hc-panel-close">
            ×
          </button>
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${H.line}` }}>
          {panel.rows && panel.rows.length > 0 && (
            <Link href={`${PATHS.participants}?rows=${panel.rows.join(",")}`} className="px-3 py-1.5 text-[13px] font-bold text-white" style={{ background: H.navy, borderRadius: 999 }} data-testid="hc-panel-table">
              לטבלה המלאה
            </Link>
          )}
          <button type="button" onClick={copy} className="px-3 py-1.5 text-[13px] font-bold" style={{ border: `1.5px solid ${H.navy}`, color: H.navy, borderRadius: 999, background: H.white }} data-testid="hc-panel-copy">
            {copied ? "הועתק" : "העתקת הרשימה"}
          </button>
        </div>
        <ol className="min-h-0 flex-1 overflow-y-auto px-2 py-2" data-testid="hc-panel-list">
          {panel.people.map((p, i) => {
            const t = p.track ? trackOf(p.track) : null;
            return (
              <li key={`${p.row}-${i}`} className="flex items-start gap-3 px-3 py-2" style={{ borderBottom: `1px solid ${H.row}` }} data-testid="hc-panel-person">
                <span className="w-6 shrink-0 pt-0.5 text-end text-[12px] tabular-nums" style={{ color: H.muted }}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[14px] font-bold" style={{ color: H.ink }}>
                      {p.name}
                    </span>
                    {t && <span aria-label={t.label} title={t.label} className="inline-block h-2.5 w-2.5 shrink-0" style={{ background: t.color, borderRadius: 3 }} />}
                    {p.flag && (
                      <span className="px-1.5 py-px text-[11px] font-bold" style={{ background: AMBER.bg, color: AMBER.ink, borderRadius: 999 }}>
                        {p.flag}
                      </span>
                    )}
                  </div>
                  {p.line && (
                    <div className="text-[12.5px] leading-snug" style={{ color: H.muted }}>
                      {p.line}
                    </div>
                  )}
                </div>
                {p.phone && (
                  <span dir="ltr" className="shrink-0 pt-0.5 text-[12.5px] tabular-nums" style={{ color: H.muted }}>
                    {p.phone}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ---- small pieces ---- */

/** A count that opens its names. */
function Num({ n, onClick, size = 15, tone = "navy", testId, label }: { n: number; onClick: () => void; size?: number; tone?: "navy" | "amber" | "muted"; testId?: string; label?: string }) {
  const color = tone === "amber" ? AMBER.ink : tone === "muted" ? H.muted : H.navy;
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-black tabular-nums leading-none transition-colors hover:opacity-80"
      style={{ color, fontSize: size, textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: tone === "amber" ? AMBER.line : "#9BB3C9", textUnderlineOffset: 5 }}
      aria-label={label}
      data-testid={testId}
    >
      {fmtNum.format(n)}
    </button>
  );
}

function SectionTitle({ id, children, count, aside }: { id: string; children: React.ReactNode; count?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div id={id} className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 scroll-mt-16">
      <div>
        <h2 className="text-[20px] font-black leading-tight" style={{ color: H.navy }}>
          {children}
          {count != null && (
            <span className="mr-2 align-middle text-[15px] font-black" style={{ color: H.muted }}>
              {count}
            </span>
          )}
        </h2>
        <span className="mt-1.5 block h-[4px] w-14" style={{ background: H.yellow, borderRadius: 2 }} />
      </div>
      {aside}
    </div>
  );
}

function Legend({ items }: { items: { key: string; label: string; color: string; count: number; onClick?: () => void }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]" aria-label="מקרא">
      {items.map((t) => (
        <li key={t.key} className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-3 w-3" style={{ background: t.color, borderRadius: 3 }} />
          <span style={{ color: H.ink }}>{t.label}</span>
          {t.onClick ? <Num n={t.count} onClick={t.onClick} size={13} tone="muted" /> : <span className="tabular-nums" style={{ color: H.muted }}>{fmtNum.format(t.count)}</span>}
        </li>
      ))}
    </ul>
  );
}

interface BarItem {
  label: string;
  chip?: string;
  total: number;
  segments: { key: string; label: string; color: string; n: number }[];
}

/** Thin stacked bars, one per item, the total at the end; every label, segment and total opens its names. */
function Bars({ items, max, onPick, testId }: { items: BarItem[]; max: number; onPick: (label: string, segKey: string | null) => void; testId: string }) {
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
      <ol className="divide-y" style={{ borderColor: H.row }} data-testid={testId}>
        {items.map((it) => {
          const segs = it.segments.filter((s) => s.n > 0);
          return (
            <li key={it.label} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1 px-5 py-2 transition-colors hover:bg-[#F6F8FA] sm:grid-cols-[minmax(170px,34%)_minmax(0,1fr)_3.25rem]" data-testid="hc-bar-row">
              <div className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:col-span-1">
                <button type="button" onClick={() => onPick(it.label, null)} className="text-start text-[13.5px] font-bold leading-snug hover:underline" style={{ color: H.ink }} data-testid="hc-bar-label">
                  {it.label}
                </button>
                {it.chip && (
                  <span className="whitespace-nowrap px-1.5 py-px text-[11px] font-bold" style={{ background: H.row, color: H.muted, borderRadius: 999 }}>
                    {it.chip}
                  </span>
                )}
              </div>
              <div className="flex h-[18px] items-center gap-[2px]" role="img" aria-label={`${it.label}: ${it.total}`}>
                {segs.map((s, i) => {
                  const w = (s.n / max) * 100;
                  const radius = `${i === 0 ? 4 : 0}px ${i === segs.length - 1 ? 4 : 0}px ${i === segs.length - 1 ? 4 : 0}px ${i === 0 ? 4 : 0}px`;
                  return (
                    <button
                      type="button"
                      key={s.key}
                      className="flex h-full items-center justify-center overflow-hidden text-[11px] font-bold transition-opacity hover:opacity-85"
                      style={{ width: `${w}%`, minWidth: 4, background: s.color, borderRadius: radius, color: s.key === "digital" ? H.navyDeep : H.white }}
                      title={`${s.label}: ${s.n}`}
                      aria-label={`${it.label} · ${s.label}: ${s.n}`}
                      onMouseEnter={(e) => show(e, `${it.label} · ${s.label}: ${s.n}`)}
                      onMouseLeave={() => setTip(null)}
                      onClick={() => onPick(it.label, s.key)}
                      data-testid="hc-seg"
                      data-track={s.key}
                    >
                      {w >= 9 ? s.n : ""}
                    </button>
                  );
                })}
              </div>
              <div className="text-end sm:text-start">
                <Num n={it.total} onClick={() => onPick(it.label, null)} testId="hc-bar-total" />
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

function BarTable({ items, columns, onPick, testId }: { items: BarItem[]; columns: { key: string; label: string }[]; onPick: (label: string, segKey: string | null) => void; testId: string }) {
  const th = "px-3 py-2 text-start text-[12.5px] font-bold whitespace-nowrap";
  const td = "px-3 py-2 text-[13.5px] tabular-nums";
  return (
    <div className="overflow-x-auto px-5 pb-5">
      <table className="w-full" data-testid={testId}>
        <thead>
          <tr style={{ background: H.row, color: H.navy }}>
            <th className={th} style={{ borderRadius: "0 8px 8px 0" }}>
              שם
            </th>
            <th className={th}>סה״כ</th>
            {columns.map((c) => (
              <th key={c.key} className={th}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.label} style={{ borderBottom: `1px solid ${H.line}` }}>
              <td className={`${td} font-bold`} style={{ color: H.ink }}>
                {it.label}
                {it.chip && (
                  <span className="mr-2 whitespace-nowrap px-1.5 py-px text-[11px] font-bold" style={{ background: H.row, color: H.muted, borderRadius: 999 }}>
                    {it.chip}
                  </span>
                )}
              </td>
              <td className={td}>
                <Num n={it.total} onClick={() => onPick(it.label, null)} />
              </td>
              {columns.map((c) => {
                const n = it.segments.find((s) => s.key === c.key)?.n ?? 0;
                return (
                  <td key={c.key} className={td} style={{ color: H.line }}>
                    {n ? <Num n={n} onClick={() => onPick(it.label, c.key)} tone="muted" size={13.5} /> : "-"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ViewToggle({ view, setView }: { view: "bars" | "table"; setView: (v: "bars" | "table") => void }) {
  const pill = (v: "bars" | "table", label: string) => (
    <button type="button" onClick={() => setView(v)} className="px-3 py-1 text-[12.5px] font-bold" style={{ background: view === v ? H.navy : H.white, color: view === v ? H.white : H.navy, border: `1.5px solid ${H.navy}`, borderRadius: 999 }} aria-pressed={view === v}>
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-1.5">
      {pill("bars", "תרשים")}
      {pill("table", "טבלה")}
    </div>
  );
}

/** A card with a stacked-bar chart and its table view. */
function ChartCard({ title, count, legend, items, columns, onPick, testId, empty }: { title: string; count: number; legend: { key: string; label: string; color: string; count: number; onClick?: () => void }[]; items: BarItem[]; columns: { key: string; label: string }[]; onPick: (label: string, segKey: string | null) => void; testId: string; empty: string }) {
  const [view, setView] = useState<"bars" | "table">("bars");
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <Card testId={testId}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pt-4 pb-2">
        <h3 className="text-[16px] font-black" style={{ color: H.navy }}>
          {title}
          <span className="mr-2 text-[14px] font-black" style={{ color: H.muted }} data-testid={`${testId}-count`}>
            {fmtNum.format(count)}
          </span>
        </h3>
        <ViewToggle view={view} setView={setView} />
      </div>
      <div className="px-5 pb-3">
        <Legend items={legend} />
      </div>
      {items.length === 0 ? (
        <p className="px-5 pb-5 text-[13.5px]" style={{ color: H.muted }}>
          {empty}
        </p>
      ) : view === "bars" ? (
        <div className="pb-3">
          <Bars items={items} max={max} onPick={onPick} testId={`${testId}-bars`} />
        </div>
      ) : (
        <BarTable items={items} columns={columns} onPick={onPick} testId={`${testId}-table`} />
      )}
    </Card>
  );
}

/* ---- the dashboard ---- */

const NAV = [
  { id: "overview", label: "סקירה" },
  { id: "frontal", label: "פרונטלי" },
  { id: "digital", label: "דיגיטלי" },
  { id: "lodging", label: "לינה ותשלומים" },
  { id: "companies", label: "חברות" },
];

function countBy<T>(list: T[], keyOf: (x: T) => string): { key: string; n: number }[] {
  const m = new Map<string, number>();
  for (const x of list) {
    const k = keyOf(x).trim() || "בלי שם";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key, "he"));
}

export function Dashboard({ data, error, sheetUrl }: { data: DashboardData | null; error: string; sheetUrl: string }) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const close = useMemo(() => () => setPanel(null), []);
  const rows = useMemo(() => data?.rows ?? [], [data]);

  const frontal = useMemo(() => rows.filter((r) => isFrontal(r.track)), [rows]);
  const digital = useMemo(() => rows.filter((r) => r.track === "digital"), [rows]);
  const other = useMemo(() => rows.filter((r) => r.track === "other"), [rows]);

  const courseItems = (list: DashRow[], segKeys: TrackKey[]): BarItem[] =>
    countBy(list, (r) => r.course || "בלי קורס").map(({ key, n }) => ({
      label: key,
      chip: data?.categoryByCourse[key],
      total: n,
      segments: segKeys.map((k) => ({ key: k, label: trackOf(k).label, color: trackOf(k).color, n: list.filter((r) => (r.course || "בלי קורס") === key && r.track === k).length })),
    }));
  const frontalItems = useMemo(() => courseItems(frontal, ["frontal", "frontalLodging"]), [frontal]); // eslint-disable-line react-hooks/exhaustive-deps
  const digitalItems = useMemo(() => courseItems(digital, ["digital"]), [digital]); // eslint-disable-line react-hooks/exhaustive-deps
  const companyItems = useMemo<BarItem[]>(
    () =>
      countBy(rows, (r) => r.company || "בלי חברה").map(({ key, n }) => {
        const of = rows.filter((r) => (r.company || "בלי חברה") === key);
        return {
          label: key,
          total: n,
          segments: [
            { key: "frontalAll", label: "פרונטלי", color: TRACKS[0].color, n: of.filter((r) => isFrontal(r.track)).length },
            { key: "digital", label: "דיגיטלי", color: TRACKS[2].color, n: of.filter((r) => r.track === "digital").length },
            { key: "other", label: "אחר", color: TRACKS[3].color, n: of.filter((r) => r.track === "other").length },
          ],
        };
      }),
    [rows]
  );

  if (!data) {
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

  // lodging (the owner: the track where the company paid, the ones who paid themselves, and the ones not recorded as paid)
  const lodgingAll = rows.filter((r) => "lodging" in r.items);
  const lodgingViaTrack = lodgingAll.filter((r) => r.track === "frontalLodging");
  const lodgingPaidSelf = lodgingAll.filter((r) => r.track !== "frontalLodging" && r.items.lodging);
  const lodgingUnpaid = lodgingAll.filter((r) => r.track !== "frontalLodging" && !r.items.lodging);
  const lodgingOnly = lodgingAll.filter((r) => r.track !== "frontalLodging");
  const itemsTable = PAID_ITEMS.filter((it) => it.key !== "lodging").map((it) => {
    const chosen = rows.filter((r) => it.key in r.items);
    return { it, chosen, paid: chosen.filter((r) => r.items[it.key as PaidKey]), unpaid: chosen.filter((r) => !r.items[it.key as PaidKey]) };
  });
  const babies = rows.filter((r) => r.baby);
  const laptopOwn = rows.filter((r) => r.laptopOwn);

  const openCourse = (list: DashRow[], label: string, segKey: string | null, listName: string) => {
    const of = list.filter((r) => (r.course || "בלי קורס") === label && (!segKey || r.track === segKey));
    setPanel(panelOf(label, of, segKey ? `${trackOf(segKey as TrackKey).label} · ${listName}` : listName));
  };
  const openCompany = (label: string, segKey: string | null) => {
    const of = rows.filter((r) => (r.company || "בלי חברה") === label && (!segKey || (segKey === "frontalAll" ? isFrontal(r.track) : r.track === segKey)));
    setPanel(panelOf(label, of, segKey === "frontalAll" ? "פרונטלי" : segKey === "digital" ? "דיגיטלי" : segKey === "other" ? "מסלול אחר" : "כל המשתתפות מהחברה"));
  };
  const openNames = (title: string, list: NameRow[]) => setPanel({ title, people: list.map((n) => ({ row: n.row, name: n.name, line: n.sub })) });
  const tracksWithCount = TRACKS.map((t) => ({ ...t, count: rows.filter((r) => r.track === t.key).length })).filter((t) => t.key !== "other" || t.count > 0);
  const total = rows.length;

  return (
    <div className="space-y-7" data-testid="hc-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-[26px] font-black leading-tight" style={{ color: H.navy }}>
            דשבורד
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: H.muted }}>
            מהגיליון ״{data.sheetTitle}״ · <ExtLink href={sheetUrl}>לפתיחה בגוגל שיטס</ExtLink> · כל מספר נלחץ ופותח את השמות
          </p>
        </div>
        <Freshness fetchedAt={data.fetchedAt} />
      </div>

      <nav className="sticky top-0 z-20 -mx-4 flex gap-1 overflow-x-auto px-4 py-2" style={{ background: H.bg, borderBottom: `1px solid ${H.line}` }} aria-label="חלקי הדשבורד" data-testid="hc-subnav">
        {NAV.map((n) => (
          <a key={n.id} href={`#${n.id}`} className="whitespace-nowrap px-3 py-1.5 text-[13px] font-bold" style={{ color: H.navy, background: H.white, border: `1px solid ${H.line}`, borderRadius: 999 }}>
            {n.label}
          </a>
        ))}
      </nav>

      {data.missingTabs.length > 0 && (
        <Notice testId="hc-missing-tabs">
          גליונות שהדשבורד מצפה להם ולא נמצאו בגיליון: {data.missingTabs.map((t) => `״${t}״`).join(", ")}. אם שינית להם שם - תגידי לי ואעדכן.
        </Notice>
      )}

      {/* ---- overview ---- */}
      <section className="space-y-4">
        <SectionTitle id="overview">סקירה</SectionTitle>
        <Card className="px-5 py-5" testId="hc-overview">
          <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
            <div className="flex items-baseline gap-3 lg:flex-col lg:items-start lg:gap-0">
              <Num n={total} onClick={() => setPanel(panelOf("כל המשתתפות", rows))} size={44} testId="hc-hero-total" />
              <div className="text-[15px] font-bold" style={{ color: H.ink }}>
                משתתפות
                <span className="mr-1.5 text-[12.5px] font-medium" style={{ color: H.muted }}>
                  בגליון ״משתתפות״
                </span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex h-[26px] w-full gap-[2px]" role="img" aria-label={tracksWithCount.map((t) => `${t.label}: ${t.count}`).join(", ")}>
                {tracksWithCount
                  .filter((t) => t.count > 0)
                  .map((t, i, arr) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setPanel(panelOf(t.label, rows.filter((r) => r.track === t.key), "לפי ״מסלול רישום״"))}
                      className="flex items-center justify-center overflow-hidden text-[12px] font-black transition-opacity hover:opacity-85"
                      style={{ width: `${(t.count / total) * 100}%`, minWidth: 6, background: t.color, color: t.key === "digital" ? H.navyDeep : H.white, borderRadius: `${i === 0 ? 6 : 0}px ${i === arr.length - 1 ? 6 : 0}px ${i === arr.length - 1 ? 6 : 0}px ${i === 0 ? 6 : 0}px` }}
                      title={`${t.label}: ${t.count}`}
                      data-testid={`hc-track-seg-${t.key}`}
                    >
                      {t.count / total >= 0.12 ? `${Math.round((t.count / total) * 100)}%` : ""}
                    </button>
                  ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2" data-testid="hc-tracks">
                {tracksWithCount.map((t) => (
                  <li key={t.key} className="flex items-center gap-2 text-[13.5px]">
                    <span aria-hidden className="inline-block h-3 w-3" style={{ background: t.color, borderRadius: 3 }} />
                    <span style={{ color: H.ink }}>{t.label}</span>
                    <Num n={t.count} onClick={() => setPanel(panelOf(t.label, rows.filter((r) => r.track === t.key), "לפי ״מסלול רישום״"))} size={15} testId={`hc-track-${t.key}`} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="hc-tiles">
            {[
              { label: "חברות", n: companyItems.length, onClick: () => document.getElementById("companies")?.scrollIntoView({ behavior: "smooth" }), sub: "ששלחו משתתפות", id: "companies" },
              { label: "בלינה", n: lodgingAll.length, onClick: () => setPanel(panelOf("בלינה", lodgingAll, "לינה = כן")), sub: "לינה = כן", id: "lodging" },
              { label: "ביטולים", n: data.extras.cancellations.length, onClick: () => openNames("ביטולים", data.extras.cancellations), sub: "הגליון ״ביטולים״", id: "cancellations" },
              { label: "יום שלישי", n: data.extras.day3.length, onClick: () => openNames("יום שלישי", data.extras.day3), sub: "הגליון ״יום שלישי״", id: "day3" },
              { label: "צוות ומרצים", n: data.extras.staff.length, onClick: () => openNames("צוות ומרצים", data.extras.staff), sub: "הגליון ״צוות ומרצים״", id: "staff" },
              { label: "תינוקות", n: babies.length, onClick: () => setPanel(panelOf("באות עם תינוק", babies, "תינוק = כן")), sub: "תינוק = כן", id: "babies" },
            ].map((t) => (
              <div key={t.id} className="px-4 py-3" style={{ border: `1px solid ${H.line}`, borderRadius: 12, background: H.bg }}>
                <Num n={t.n} onClick={t.onClick} size={24} testId={`hc-tile-${t.id}`} />
                <div className="mt-1 text-[13px] font-bold" style={{ color: H.ink }}>
                  {t.label}
                </div>
                <div className="text-[11.5px]" style={{ color: H.muted }}>
                  {t.sub}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ---- frontal courses ---- */}
      <section className="space-y-4">
        <SectionTitle id="frontal" count={fmtNum.format(frontal.length)}>
          קורסים פרונטליים
        </SectionTitle>
        <ChartCard
          title="משתתפות בכל קורס פרונטלי"
          count={frontal.length}
          legend={[
            { key: "frontal", label: TRACKS[0].label, color: TRACKS[0].color, count: tracksWithCount.find((t) => t.key === "frontal")?.count ?? 0, onClick: () => setPanel(panelOf(TRACKS[0].label, rows.filter((r) => r.track === "frontal"))) },
            { key: "frontalLodging", label: TRACKS[1].label, color: TRACKS[1].color, count: tracksWithCount.find((t) => t.key === "frontalLodging")?.count ?? 0, onClick: () => setPanel(panelOf(TRACKS[1].label, rows.filter((r) => r.track === "frontalLodging"))) },
          ]}
          items={frontalItems}
          columns={[
            { key: "frontal", label: TRACKS[0].label },
            { key: "frontalLodging", label: TRACKS[1].label },
          ]}
          onPick={(label, seg) => openCourse(frontal, label, seg, "פרונטלי")}
          testId="hc-frontal"
          empty="אין משתתפות במסלול פרונטלי."
        />
      </section>

      {/* ---- digital courses ---- */}
      <section className="space-y-4">
        <SectionTitle id="digital" count={fmtNum.format(digital.length)}>
          קורסים דיגיטליים
        </SectionTitle>
        <ChartCard
          title="משתתפות בכל קורס דיגיטלי"
          count={digital.length}
          legend={[{ key: "digital", label: TRACKS[2].label, color: TRACKS[2].color, count: digital.length, onClick: () => setPanel(panelOf(TRACKS[2].label, digital)) }]}
          items={digitalItems}
          columns={[{ key: "digital", label: TRACKS[2].label }]}
          onPick={(label, seg) => openCourse(digital, label, seg, "דיגיטלי")}
          testId="hc-digital"
          empty="אין משתתפות במסלול דיגיטלי."
        />
        {other.length > 0 && (
          <Notice testId="hc-other-track">
            <Num n={other.length} onClick={() => setPanel(panelOf("מסלול לא מזוהה", other, "ערך ב״מסלול רישום״ שאינו אחד משלושת המסלולים"))} size={14} tone="amber" /> משתתפות עם ערך ב״מסלול רישום״ שאינו אחד משלושת המסלולים - הן לא בשתי הרשימות.
          </Notice>
        )}
      </section>

      {/* ---- lodging + paid items ---- */}
      <section className="space-y-4">
        <SectionTitle id="lodging" count={fmtNum.format(lodgingAll.length)}>
          לינה ותשלומים
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card className="px-5 py-5" testId="hc-lodging">
            <h3 className="text-[16px] font-black" style={{ color: H.navy }}>
              בלינה
              <span className="mr-2 text-[14px] font-black" style={{ color: H.muted }}>
                <Num n={lodgingAll.length} onClick={() => setPanel(panelOf("בלינה", lodgingAll, "לינה = כן"))} size={14} tone="muted" testId="hc-lodging-total" />
              </span>
            </h3>
            <p className="mt-0.5 text-[12.5px]" style={{ color: H.muted }}>
              בנפרד מהקורס - לפי העמודות ״לינה״, ״מסלול רישום״ ו״שולם לינה״
            </p>
            <div className="mt-4 flex h-[22px] w-full gap-[2px]" role="img" aria-label={`דרך המסלול ${lodgingViaTrack.length}, שילמו בעצמן ${lodgingPaidSelf.length}, לא כתוב ששולם ${lodgingUnpaid.length}`}>
              {[
                { n: lodgingViaTrack.length, color: TRACKS[1].color },
                { n: lodgingPaidSelf.length, color: H.navy },
                { n: lodgingUnpaid.length, color: AMBER.line },
              ]
                .filter((s) => s.n > 0)
                .map((s, i, arr) => (
                  <span key={i} className="block h-full" style={{ width: `${(s.n / Math.max(1, lodgingAll.length)) * 100}%`, minWidth: 4, background: s.color, borderRadius: `${i === 0 ? 5 : 0}px ${i === arr.length - 1 ? 5 : 0}px ${i === arr.length - 1 ? 5 : 0}px ${i === 0 ? 5 : 0}px` }} />
                ))}
            </div>
            <dl className="mt-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[13.5px]" style={{ color: H.ink }}>
                  <span aria-hidden className="ml-2 inline-block h-3 w-3 align-middle" style={{ background: TRACKS[1].color, borderRadius: 3 }} />
                  במסלול ״פרונטלי כולל לינה״
                  <span className="block text-[12px]" style={{ color: H.muted }}>
                    החברה שילמה את הלינה במסגרת המסלול
                  </span>
                </dt>
                <dd>
                  <Num n={lodgingViaTrack.length} onClick={() => setPanel(panelOf("לינה במסלול ״פרונטלי כולל לינה״", lodgingViaTrack, "החברה שילמה"))} size={20} testId="hc-lodging-track" />
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[13.5px]" style={{ color: H.ink }}>
                  <span aria-hidden className="ml-2 inline-block h-3 w-3 align-middle" style={{ background: H.navy, borderRadius: 3 }} />
                  שילמו על הלינה בעצמן
                  <span className="block text-[12px]" style={{ color: H.muted }}>
                    מסלול ללא לינה, ״שולם לינה״ = כן
                  </span>
                </dt>
                <dd>
                  <Num n={lodgingPaidSelf.length} onClick={() => setPanel(panelOf("שילמו על הלינה בעצמן", lodgingPaidSelf, "״שולם לינה״ = כן"))} size={20} testId="hc-lodging-paid" />
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 px-3 py-2.5" style={{ background: AMBER.bg, border: `1px solid ${AMBER.line}`, borderRadius: 10 }}>
                <dt className="text-[13.5px] font-bold" style={{ color: AMBER.ink }}>
                  בחרו לינה ולא כתוב ששולם
                  <span className="block text-[12px] font-medium" style={{ color: AMBER.ink }}>
                    מסלול ללא לינה, ״שולם לינה״ ריק או ״לא״
                  </span>
                </dt>
                <dd>
                  <Num n={lodgingUnpaid.length} onClick={() => setPanel(panelOf("בחרו לינה ולא כתוב ששולם", lodgingUnpaid, "״שולם לינה״ ריק או ״לא״", () => "לא כתוב ששולם"))} size={20} tone="amber" testId="hc-lodging-unpaid" />
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[12.5px]" style={{ color: H.muted }}>
              <Num n={lodgingOnly.length} onClick={() => setPanel(panelOf("לינה מחוץ למסלול", lodgingOnly, "בחרו לינה במסלול ללא לינה", (r) => (r.items.lodging ? undefined : "לא כתוב ששולם")))} size={12.5} tone="muted" testId="hc-lodging-self" /> מהן בחרו לינה מחוץ למסלול (שילמו + לא כתוב ששולם).
            </p>
          </Card>

          <Card testId="hc-paid-items">
            <div className="px-5 pt-5">
              <h3 className="text-[16px] font-black" style={{ color: H.navy }}>
                סעיפי תשלום נוספים
              </h3>
              <p className="mt-0.5 text-[12.5px]" style={{ color: H.muted }}>
                מי שבחרה את הסעיף, מי שכתוב אצלה ששולם, ומי שלא
              </p>
            </div>
            <div className="overflow-x-auto px-5 pb-5 pt-3">
              <table className="w-full">
                <thead>
                  <tr style={{ background: H.row, color: H.navy }}>
                    <th className="px-3 py-2 text-start text-[12.5px] font-bold" style={{ borderRadius: "0 8px 8px 0" }}>
                      סעיף
                    </th>
                    <th className="px-3 py-2 text-start text-[12.5px] font-bold">בחרו</th>
                    <th className="px-3 py-2 text-start text-[12.5px] font-bold">שולם</th>
                    <th className="px-3 py-2 text-start text-[12.5px] font-bold" style={{ borderRadius: "8px 0 0 8px", color: AMBER.ink }}>
                      לא כתוב ששולם
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {itemsTable.map(({ it, chosen, paid, unpaid }) => (
                    <tr key={it.key} style={{ borderBottom: `1px solid ${H.line}` }} data-testid="hc-paid-row" data-item={it.key}>
                      <td className="px-3 py-2.5 text-[13.5px] font-bold" style={{ color: H.ink }}>
                        {it.label}
                        <span className="block text-[11.5px] font-medium" style={{ color: H.muted }}>
                          ״{it.chosen}״ / ״{it.paid}״
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{chosen.length ? <Num n={chosen.length} onClick={() => setPanel(panelOf(`${it.label} - בחרו`, chosen, `״${it.chosen}״ = כן`, (r) => (r.items[it.key as PaidKey] ? undefined : "לא כתוב ששולם")))} testId="hc-paid-chosen" /> : <span style={{ color: H.line }}>-</span>}</td>
                      <td className="px-3 py-2.5">{paid.length ? <Num n={paid.length} onClick={() => setPanel(panelOf(`${it.label} - שולם`, paid, `״${it.paid}״ = כן`))} testId="hc-paid-paid" /> : <span style={{ color: H.line }}>-</span>}</td>
                      <td className="px-3 py-2.5">
                        {unpaid.length ? (
                          <span className="inline-flex items-center px-2 py-0.5" style={{ background: AMBER.bg, borderRadius: 999 }}>
                            <Num n={unpaid.length} onClick={() => setPanel(panelOf(`${it.label} - לא כתוב ששולם`, unpaid, `״${it.paid}״ ריק או ״לא״`, () => "לא כתוב ששולם"))} tone="amber" testId="hc-paid-unpaid" />
                          </span>
                        ) : (
                          <span style={{ color: H.line }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[12.5px]" style={{ color: H.muted }}>
                <Num n={laptopOwn.length} onClick={() => setPanel(panelOf("מביאות מחשב נייד משלהן", laptopOwn, "״מחשב נייד״ = כן"))} size={12.5} tone="muted" testId="hc-laptop-own" /> מביאות מחשב נייד משלהן (״מחשב נייד״ = כן) - לא סעיף תשלום.
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* ---- companies ---- */}
      <section className="space-y-4">
        <SectionTitle id="companies" count={fmtNum.format(companyItems.length)}>
          לפי חברות
        </SectionTitle>
        <ChartCard
          title="משתתפות מכל חברה"
          count={total}
          legend={[
            { key: "frontalAll", label: "פרונטלי", color: TRACKS[0].color, count: frontal.length, onClick: () => setPanel(panelOf("פרונטלי", frontal, "שני המסלולים הפרונטליים")) },
            { key: "digital", label: "דיגיטלי", color: TRACKS[2].color, count: digital.length, onClick: () => setPanel(panelOf("דיגיטלי", digital)) },
            ...(other.length ? [{ key: "other", label: "אחר", color: TRACKS[3].color, count: other.length }] : []),
          ]}
          items={companyItems}
          columns={[
            { key: "frontalAll", label: "פרונטלי" },
            { key: "digital", label: "דיגיטלי" },
            ...(other.length ? [{ key: "other", label: "אחר" }] : []),
          ]}
          onPick={openCompany}
          testId="hc-companies"
          empty="אין חברות."
        />
      </section>

      {panel && <NamesPanel panel={panel} onClose={close} />}
    </div>
  );
}
