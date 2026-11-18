"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { H } from "../../../ai-course/theme";
import type { TabDef } from "../../config";
import { Freshness } from "../../gate";
import { Card, ExtLink, fmtNum } from "../../ui";

/*
  A tab of the sheet, as is: its header row, a search over every cell, the
  first 200 matches with more on demand, links rendered as links. Columns
  the sheet left unnamed show as ״עמודה N״.
*/
const PAGE = 200;
const URL_RE = /^https?:\/\/\S+$/i;

function Cell({ v }: { v: string }) {
  if (!v) return <span style={{ color: H.line }}>-</span>;
  if (URL_RE.test(v))
    return (
      <a href={v} target="_blank" rel="noreferrer" className="underline underline-offset-2" style={{ color: H.navy }} dir="ltr">
        קישור
      </a>
    );
  const long = v.length > 90;
  return (
    <span title={long ? v : undefined} className={long ? "block max-w-[320px] truncate" : "whitespace-nowrap"}>
      {v}
    </span>
  );
}

export function SheetTable({ tab, header, rows, fetchedAt, sheetUrl }: { tab: TabDef; header: string[]; rows: string[][]; fetchedAt: string; sheetUrl: string }) {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [limit, setLimit] = useState(PAGE);
  const filtered = useMemo(() => {
    const needle = dq.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.some((v) => v.toLowerCase().includes(needle)));
  }, [rows, dq]);
  const shown = filtered.slice(0, limit);
  const th = "px-3 py-2 text-start text-[12.5px] font-bold whitespace-nowrap";

  return (
    <div className="space-y-4" data-testid="hc-sheet">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-[24px] font-black leading-tight" style={{ color: H.navy }} data-testid="hc-sheet-title">
            {tab.title}
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: H.muted }}>
            {tab.note ? `${tab.note} · ` : ""}
            <ExtLink href={sheetUrl}>לפתיחה בגוגל שיטס</ExtLink>
          </p>
        </div>
        <Freshness fetchedAt={fetchedAt} />
      </div>

      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="חיפוש בכל העמודות..."
            className="w-full max-w-md bg-white px-3 py-2 text-[14px] outline-none"
            style={{ border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink }}
            data-testid="hc-sheet-search"
          />
          <span className="text-[13px]" style={{ color: H.muted }} data-testid="hc-sheet-count">
            {filtered.length === rows.length ? `${fmtNum.format(rows.length)} שורות` : `${fmtNum.format(filtered.length)} מתוך ${fmtNum.format(rows.length)}`}
            {" · "}
            {header.length} עמודות
          </span>
        </div>
      </Card>

      <Card>
        <div className="overflow-auto" style={{ maxHeight: "72vh" }}>
          <table className="w-full" data-testid="hc-sheet-table">
            <thead className="sticky top-0 z-[1]">
              <tr style={{ background: H.row, color: H.navy }}>
                {header.map((h, i) => (
                  <th key={i} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${H.line}` }} data-testid="hc-sheet-row">
                  {r.map((v, j) => (
                    <td key={j} className="px-3 py-1.5 align-top text-[13px]" style={{ color: H.ink }}>
                      <Cell v={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="px-5 py-6 text-center text-[14px]" style={{ color: H.muted }}>
            אין שורות שמתאימות לחיפוש.
          </p>
        )}
        {filtered.length > shown.length && (
          <div className="px-5 py-4 text-center">
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="px-5 py-2 text-[14px] font-bold" style={{ border: `1.5px solid ${H.navy}`, color: H.navy, borderRadius: 999, background: H.white }} data-testid="hc-sheet-more">
              להציג עוד ({fmtNum.format(filtered.length - shown.length)} נוספות)
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
