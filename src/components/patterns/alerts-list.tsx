"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { Badge } from "@/components/ui";
import { MarkReadButton } from "@/components/patterns/alert-row-actions";

export interface AlertItem {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string | null;
  count: number;
  read_at: string | null;
  last_seen_at: string;
  dedupe_key: string | null;
  context: unknown;
}

const SEVERITY: Record<string, { label: string; variant: "pink" | "warm" | "tech" }> = {
  critical: { label: "קריטי", variant: "pink" },
  warning: { label: "אזהרה", variant: "warm" },
  info: { label: "מידע", variant: "tech" },
};

const FULL_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/** "לפני 10 דקות" / "לפני 3 שעות" / "לפני 4 ימים" — beside the full date. */
function relativeHe(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 2) return "ממש עכשיו";
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "לפני שעה" : `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

/** Day bucket for the group headers. */
function dayBucket(iso: string): "היום" | "אתמול" | "השבוע" | "מוקדם יותר" {
  const now = new Date();
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return "היום";
  if (diffDays === 1) return "אתמול";
  if (diffDays < 7) return "השבוע";
  return "מוקדם יותר";
}

/**
 * Where does this alert send the admin to ACT? Every actionable kind gets a
 * button — reading an alert should never end with "ומה עכשיו?".
 */
function actionFor(a: AlertItem): { href: string; label: string } | null {
  const ctx = (a.context ?? {}) as { profileId?: string };
  switch (a.kind) {
    case "subscription_expired":
      return ctx.profileId
        ? { href: `/admin/members/${ctx.profileId}`, label: "לרישום ידני בדף שלה" }
        : { href: "/admin/members", label: "למסך החברות" };
    case "subscription_cancel_requested":
    case "subscription_cancel_reverted":
      return ctx.profileId
        ? { href: `/admin/members/${ctx.profileId}`, label: "לדף שלה" }
        : null;
    case "drive_share_failed":
      return { href: "/admin/shares", label: "לתור השיתופים" };
    case "external_payment_unverified":
    case "external_payment_stored":
    case "external_payment_matched":
    case "external_payment_claimed":
    case "payment_rejected":
    case "payment_renewal_incomplete":
      return { href: "/admin/payments", label: "למסך התשלומים" };
    case "member_request":
      return a.dedupe_key?.startsWith("mentor-request:")
        ? { href: "/admin/mentors", label: "לאישור המנטוריות" }
        : { href: "/admin/requests", label: "לפניות לצוות" };
    default:
      return null;
  }
}

type Filter = "unread" | "all" | "warnings";
const PAGE_SIZE = 30;

export function AlertsList({ alerts }: { alerts: AlertItem[] }) {
  // Shira: default shows only what was not read yet.
  const [filter, setFilter] = useState<Filter>("unread");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const unreadCount = alerts.filter((a) => !a.read_at).length;
  const warnCount = alerts.filter(
    (a) => !a.read_at && (a.severity === "critical" || a.severity === "warning")
  ).length;

  const filtered = useMemo(() => {
    const needle = q.trim();
    let list = alerts;
    if (filter === "unread") list = list.filter((a) => !a.read_at);
    if (filter === "warnings")
      list = list.filter((a) => a.severity === "critical" || a.severity === "warning");
    if (needle) {
      list = list.filter((a) => `${a.title} ${a.body ?? ""}`.includes(needle));
    }
    // Newest day first; INSIDE each day what needs handling floats up —
    // critical, then warnings, then info. Day headers stay contiguous this way.
    const rank = (a: AlertItem) => (a.severity === "critical" ? 0 : a.severity === "warning" ? 1 : 2);
    const dayKey = (a: AlertItem) => a.last_seen_at.slice(0, 10);
    return list.slice().sort((a, b) => {
      const day = dayKey(b).localeCompare(dayKey(a));
      if (day !== 0) return day;
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return a.last_seen_at < b.last_seen_at ? 1 : -1;
    });
  }, [alerts, filter, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Day headers inside the page — a header renders on the first row of each
  // bucket (precomputed; render must not mutate).
  const headerFlags = pageItems.map(
    (a, i) => i === 0 || dayBucket(a.last_seen_at) !== dayBucket(pageItems[i - 1].last_seen_at)
  );

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "unread", label: `לא נקרא (${unreadCount})` },
    { id: "warnings", label: `אזהרות (${warnCount})` },
    { id: "all", label: "הכל" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id);
              setPage(0);
            }}
            className={
              "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer " +
              (filter === f.id
                ? "bg-brand-gradient border-transparent text-white"
                : "bg-white border-ink-200 text-ink-700 hover:border-brand-purple")
            }
          >
            {f.label}
          </button>
        ))}
        <label className="ms-auto relative">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 end-2.5 text-ink-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="חיפוש בהתראות…"
            className="w-56 text-[12.5px] border border-ink-300 rounded-md ps-3 pe-8 py-1.5 outline-none focus:border-brand-purple bg-white"
          />
        </label>
      </div>

      {pageItems.length === 0 ? (
        <div className="bg-white border border-ink-200 rounded-[14px] p-8 text-center text-sm text-ink-500">
          {filter === "unread"
            ? "אין התראות שלא נקראו — הכול מטופל 💜"
            : "אין התראות שמתאימות לסינון."}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {pageItems.map((a, i) => {
            const sev = SEVERITY[a.severity] ?? SEVERITY.info;
            const action = actionFor(a);
            const bucket = dayBucket(a.last_seen_at);
            const showHeader = headerFlags[i];
            return (
              <div key={a.id} className="flex flex-col gap-1.5">
                {showHeader && (
                  <div className="text-[11.5px] font-bold text-ink-500 mt-2 first:mt-0">
                    {bucket}
                  </div>
                )}
                <div
                  className={
                    "bg-white border rounded-[12px] px-4 py-2.5 flex flex-col gap-1 " +
                    (a.read_at
                      ? "border-ink-200 opacity-60"
                      : a.severity === "critical"
                        ? "border-brand-pink-deep border-[1.5px]"
                        : a.severity === "warning"
                          ? "border-[#E5C55C]"
                          : "border-ink-200")
                  }
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={sev.variant}>{sev.label}</Badge>
                    {!a.read_at && (
                      <span className="w-2 h-2 rounded-full bg-brand-pink-deep shrink-0" aria-label="לא נקראה" />
                    )}
                    <span className="font-display font-bold text-ink-1000 text-[14px]">{a.title}</span>
                    {a.count > 1 && (
                      <span className="text-[11px] font-mono text-ink-500 bg-ink-50 border border-ink-200 rounded-full px-2">
                        ×{a.count}
                      </span>
                    )}
                    <span className="ms-auto text-[11.5px] text-ink-400 whitespace-nowrap">
                      {relativeHe(a.last_seen_at)}
                      <span className="text-ink-300"> · </span>
                      <span dir="ltr">{FULL_DATE.format(new Date(a.last_seen_at))}</span>
                    </span>
                  </div>
                  {a.body && <p className="text-[12.5px] text-ink-700 leading-relaxed">{a.body}</p>}
                  {(action || !a.read_at) && (
                    <div className="flex items-center gap-3 pt-0.5">
                      {action && (
                        <Link
                          href={action.href}
                          className="inline-flex items-center gap-1 text-[12.5px] font-bold text-white bg-brand-gradient rounded-md px-3 py-1"
                        >
                          {action.label} <ArrowLeft size={12} />
                        </Link>
                      )}
                      {!a.read_at && <MarkReadButton id={a.id} />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
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
