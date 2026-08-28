"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search, Undo2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { reopenMentorRequest } from "@/app/(admin)/admin/actions";

export interface HandledRequestRow {
  id: string;
  profileId: string;
  memberName: string;
  kind: string;
  reasonLabel: string;
  mentorName: string | null;
  accepted: boolean;
  createdAt: string;
  handledAt: string | null;
  reopenReason: string | null;
}

const FULL_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

function relativeHe(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return "היום";
  const hours = Math.round(mins / 60);
  if (hours < 24) return "היום";
  const days = Math.round(hours / 24);
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

/** How long the request waited from creation to handling. */
function waitedHe(createdIso: string, handledIso: string | null): string {
  if (!handledIso) return "";
  const hours = Math.round((Date.parse(handledIso) - Date.parse(createdIso)) / 3_600_000);
  if (hours < 1) return "טופלה תוך פחות משעה";
  if (hours < 24) return `טופלה תוך ${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? "טופלה תוך יום" : `טופלה תוך ${days} ימים`;
}

/** Reopen with a REQUIRED reason — the server refuses without one. */
function ReopenControl({ requestId, mentorName }: { requestId: string; mentorName: string | null }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-500 hover:text-brand-purple cursor-pointer"
      >
        <Undo2 size={12} /> החזרה לטיפול
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap bg-tint-warm/60 border border-[#F0DCA8] rounded-md px-2.5 py-1.5">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="למה מחזירים? (חובה)"
        className="text-[12px] border border-ink-300 rounded-md px-2 py-1 outline-none focus:border-brand-purple w-44"
      />
      <Button
        type="button"
        size="sm"
        disabled={pending || !reason.trim()}
        onClick={() => {
          const msg = mentorName
            ? `להחזיר לטיפול? השיבוץ של ${mentorName} יבוטל והיא לא תראה יותר את ההזמנה.`
            : "להחזיר את הבקשה לטיפול?";
          if (!confirm(msg)) return;
          const fd = new FormData();
          fd.set("reason", reason);
          start(() => reopenMentorRequest(requestId, fd));
        }}
      >
        {pending ? "מחזירה…" : "אישור החזרה"}
      </Button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[11.5px] text-ink-400 hover:text-ink-700 cursor-pointer"
      >
        ביטול
      </button>
    </div>
  );
}

const PAGE_SIZE = 20;

export function HandledRequestsList({ rows }: { rows: HandledRequestRow[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim();
    if (!needle) return rows;
    return rows.filter((r) =>
      `${r.memberName} ${r.mentorName ?? ""} ${r.reasonLabel}`.includes(needle)
    );
  }, [rows, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h3 className="font-display text-base font-bold">טופלו ({rows.length})</h3>
        <label className="ms-auto relative">
          <Search size={13} className="absolute top-1/2 -translate-y-1/2 end-2.5 text-ink-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="חיפוש לפי שם / מנטורית…"
            className="w-52 text-[12.5px] border border-ink-300 rounded-md ps-3 pe-8 py-1.5 outline-none focus:border-brand-purple"
          />
        </label>
      </div>

      <div className="flex flex-col">
        {pageRows.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap opacity-80"
          >
            <Link
              href={`/admin/members/${r.profileId}`}
              className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
            >
              {r.memberName}
            </Link>
            {r.kind === "employment" ? (
              <Badge variant="warm">ליווי תעסוקתי 💼</Badge>
            ) : (
              <Badge variant="indigo">{r.reasonLabel}</Badge>
            )}
            {r.mentorName && (
              <span className="text-[12px] font-semibold text-[#8C5E0E]">
                👑 {r.mentorName}
                {r.accepted ? (
                  <span className="text-success"> · אישרה ✓</span>
                ) : (
                  <span className="text-brand-pink-deep"> · ממתין לאישור שלה</span>
                )}
              </span>
            )}
            <span className="text-[11.5px] text-ink-500 whitespace-nowrap">
              {r.handledAt ? relativeHe(r.handledAt) : ""}
              {r.handledAt && (
                <>
                  <span className="text-ink-300"> · </span>
                  <span dir="ltr">{FULL_DATE.format(new Date(r.handledAt))}</span>
                </>
              )}
            </span>
            <span className="text-[11px] text-ink-400">{waitedHe(r.createdAt, r.handledAt)}</span>
            <div className="ms-auto">
              <ReopenControl requestId={r.id} mentorName={r.accepted ? r.mentorName : null} />
            </div>
          </div>
        ))}
        {pageRows.length === 0 && (
          <p className="text-ink-500 text-sm py-2">לא נמצאו בקשות בחיפוש הזה.</p>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            className="text-[12.5px] font-semibold text-brand-purple disabled:text-ink-300 cursor-pointer disabled:cursor-default"
          >
            → הקודם
          </button>
          <span className="text-[12px] text-ink-500">
            עמוד {safePage + 1} מתוך {pages}
          </span>
          <button
            type="button"
            disabled={safePage >= pages - 1}
            onClick={() => setPage(safePage + 1)}
            className="text-[12.5px] font-semibold text-brand-purple disabled:text-ink-300 cursor-pointer disabled:cursor-default"
          >
            הבא ←
          </button>
        </div>
      )}
    </div>
  );
}
