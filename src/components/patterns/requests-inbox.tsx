"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Crown, Search, Settings2 } from "lucide-react";
import { Badge, Button, Textarea } from "@/components/ui";
import { replyToMemberRequest, saveInboxSettings } from "@/app/(admin)/admin/actions";

export interface InboxRequest {
  id: string;
  profile_id: string;
  memberName: string;
  /** Paying member — the מנויה pill (the owner, 2/9). */
  isSubscriber?: boolean;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  handled_at: string | null;
  handled_by_name: string | null;
  reply: string | null;
}

export interface CannedReply {
  title: string;
  body: string;
}

const FULL_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

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

/** "חיכתה 3 ימים" — how long a request waited before it was handled. */
function waitedHe(createdIso: string, handledIso: string | null): string | null {
  const end = handledIso ? Date.parse(handledIso) : Date.now();
  const hours = Math.round((end - Date.parse(createdIso)) / 3_600_000);
  if (hours < 1) return "פחות משעה";
  if (hours < 24) return `${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? "יום" : `${days} ימים`;
}

const isMentorJoin = (subject: string) => subject.includes("מנטורית");

function OpenRequestCard({
  r,
  expanded,
  onToggle,
  teamNames,
  canned,
}: {
  r: InboxRequest;
  expanded: boolean;
  onToggle: () => void;
  teamNames: string[];
  canned: CannedReply[];
}) {
  const [reply, setReply] = useState("");
  const [who, setWho] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (skip: boolean) => {
    if (!skip && !reply.trim()) return;
    if (skip && !confirm("לסמן כטופל בלי לענות לה? היא לא תקבל שום הודעה.")) return;
    const fd = new FormData();
    fd.set("reply", skip ? "" : reply);
    if (skip) fd.set("skip_reply", "1");
    fd.set("handled_by_name", who);
    start(async () => {
      await replyToMemberRequest(r.id, fd);
      setSent(skip ? "סומן כטופל." : "התשובה נשלחה אליה בצ'אט ✓");
    });
  };

  return (
    <div className="border-[1.5px] border-brand-purple/40 bg-white rounded-[14px] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-start px-4 py-3 flex items-center gap-2.5 flex-wrap cursor-pointer hover:bg-tint-purple/30"
      >
        <span className="font-semibold text-ink-900">{r.memberName}</span>
        {r.isSubscriber && (
          <span className="text-[10.5px] font-bold bg-tint-pink text-brand-pink-deep px-2 py-0.5 rounded-full">
            מנויה
          </span>
        )}
        <Badge variant="purple">{r.subject}</Badge>
        <span className="text-[11.5px] text-ink-500">
          {relativeHe(r.created_at)}
          <span className="text-ink-300"> · </span>
          <span dir="ltr">{FULL_DATE.format(new Date(r.created_at))}</span>
        </span>
        <span className="text-[11.5px] font-semibold text-brand-pink-deep">
          ממתינה {waitedHe(r.created_at, null)}
        </span>
        <ChevronDown
          size={16}
          className={"ms-auto text-ink-400 transition-transform " + (expanded ? "rotate-180" : "")}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-2.5 border-t border-ink-100 pt-3">
          <p className="text-[13.5px] text-ink-700 whitespace-pre-wrap">{r.body}</p>
          <div className="flex items-center gap-3 flex-wrap text-[12.5px]">
            <Link
              href={`/admin/members/${r.profile_id}`}
              className="font-semibold text-brand-purple hover:underline"
            >
              לפרופיל שלה ←
            </Link>
            {isMentorJoin(r.subject) && (
              <Link
                href="/admin/mentors"
                className="inline-flex items-center gap-1 font-semibold text-brand-purple hover:underline"
              >
                <Crown size={13} /> לאישור במסך המנטוריות ←
              </Link>
            )}
          </div>

          {sent ? (
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-success bg-tint-mint border border-[#BFE4D1] rounded-md px-3.5 py-2.5">
              <CheckCircle2 size={16} /> {sent}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {canned.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const c = canned.find((x) => x.title === e.target.value);
                    if (c) setReply((cur) => (cur ? cur + "\n" + c.body : c.body));
                    e.target.value = "";
                  }}
                  className="w-fit text-[12.5px] border border-ink-300 rounded-md px-2.5 py-1.5 bg-white text-ink-700"
                >
                  <option value="" disabled>
                    תשובה מוכנה…
                  </option>
                  {canned.map((c) => (
                    <option key={c.title} value={c.title}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                placeholder="התשובה שלך — תישלח אליה בצ'אט…"
              />
              <div className="flex items-center gap-2.5 flex-wrap">
                {teamNames.length > 0 && (
                  <select
                    value={who}
                    onChange={(e) => setWho(e.target.value)}
                    className="text-[12.5px] border border-ink-300 rounded-md px-2.5 py-1.5 bg-white text-ink-700"
                  >
                    <option value="">מי מטפלת?</option>
                    {teamNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                )}
                <Button type="button" size="sm" disabled={pending || !reply.trim()} onClick={() => submit(false)}>
                  {pending ? "שולח…" : "שליחת תשובה בצ'אט + סימון טופל"}
                </Button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submit(true)}
                  className="text-[12.5px] font-semibold text-ink-500 hover:text-danger border border-ink-300 rounded-md px-3 py-1.5 cursor-pointer"
                >
                  סימון כטופל בלי תשובה
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;
type Period = "all" | "7" | "30";

export function RequestsInbox({
  requests,
  teamNames,
  canned,
}: {
  requests: InboxRequest[];
  teamNames: string[];
  canned: CannedReply[];
}) {
  const open = requests.filter((r) => r.status === "open");
  const handled = requests.filter((r) => r.status !== "open");

  // The first waiting request opens; the rest fold (Shira: no endless scroll).
  const [expandedId, setExpandedId] = useState<string | null>(open[0]?.id ?? null);
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("30");
  // Snapshotted once — Date.now() must not run inside render/memo.
  const [loadedAt] = useState(() => Date.now());
  const [page, setPage] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedHandled, setExpandedHandled] = useState<string | null>(null);

  const filteredHandled = useMemo(() => {
    let list = handled;
    if (period !== "all") {
      const cutoff = loadedAt - Number(period) * 86_400_000;
      list = list.filter((r) => Date.parse(r.handled_at ?? r.created_at) >= cutoff);
    }
    const needle = q.trim();
    if (needle) {
      list = list.filter((r) =>
        `${r.memberName} ${r.subject} ${r.body} ${r.reply ?? ""} ${r.handled_by_name ?? ""}`.includes(needle)
      );
    }
    return list;
  }, [handled, q, period, loadedAt]);

  const pages = Math.max(1, Math.ceil(filteredHandled.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageItems = filteredHandled.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">
      {/* Waiting — emphasized, one open at a time */}
      <div className="rounded-[18px] p-[2px] bg-brand-gradient">
        <div className="bg-white rounded-[16px] p-5 flex flex-col gap-3">
          <h3 className="font-display text-base font-bold">ממתינות ({open.length})</h3>
          {open.length > 0 ? (
            open.map((r) => (
              <OpenRequestCard
                key={r.id}
                r={r}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                teamNames={teamNames}
                canned={canned}
              />
            ))
          ) : (
            <p className="text-ink-500 text-sm">אין בקשות פתוחות כרגע 💜</p>
          )}
        </div>
      </div>

      {/* Handled — muted, searchable, paged */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="font-display text-base font-bold">טופלו ({handled.length})</h3>
          <div className="flex gap-1">
            {(
              [
                ["7", "שבוע"],
                ["30", "חודש"],
                ["all", "הכל"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setPeriod(v);
                  setPage(0);
                }}
                className={
                  "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold cursor-pointer " +
                  (period === v
                    ? "bg-ink-1000 border-transparent text-white"
                    : "bg-white border-ink-200 text-ink-600")
                }
              >
                {label}
              </button>
            ))}
          </div>
          <label className="ms-auto relative">
            <Search size={13} className="absolute top-1/2 -translate-y-1/2 end-2.5 text-ink-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="חיפוש…"
              className="w-44 text-[12.5px] border border-ink-300 rounded-md ps-3 pe-8 py-1.5 outline-none focus:border-brand-purple"
            />
          </label>
        </div>

        {pageItems.length > 0 ? (
          <div className="flex flex-col">
            {pageItems.map((r) => (
              <div key={r.id} className="py-2 border-b border-ink-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpandedHandled(expandedHandled === r.id ? null : r.id)}
                  className="w-full text-start flex items-center gap-2.5 flex-wrap opacity-80 hover:opacity-100 cursor-pointer"
                >
                  <Link
                    href={`/admin/members/${r.profile_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                  >
                    {r.memberName}
                  </Link>
                  <span className="text-[13px] text-ink-700 flex-1 truncate">{r.subject}</span>
                  {r.handled_by_name && <Badge variant="gray">טיפלה: {r.handled_by_name}</Badge>}
                  <span className="text-[11.5px] text-ink-500 whitespace-nowrap">
                    טופל {r.handled_at ? relativeHe(r.handled_at) : ""}
                    <span className="text-ink-300"> · </span>
                    <span dir="ltr">{r.handled_at ? FULL_DATE.format(new Date(r.handled_at)) : ""}</span>
                  </span>
                  <span className="text-[11px] text-ink-400 whitespace-nowrap">
                    חיכתה {waitedHe(r.created_at, r.handled_at)}
                  </span>
                </button>
                {expandedHandled === r.id && (
                  <div className="mt-2 ps-2 border-s-2 border-ink-100 flex flex-col gap-1.5">
                    <p className="text-[12.5px] text-ink-600 whitespace-pre-wrap">{r.body}</p>
                    {r.reply ? (
                      <p className="text-[12.5px] text-ink-700 bg-tint-purple/40 rounded-md px-3 py-2 whitespace-pre-wrap">
                        <b className="text-brand-purple">התשובה שנשלחה:</b> {r.reply}
                      </p>
                    ) : (
                      <p className="text-[12px] text-ink-400">טופל בלי תשובה בצ&apos;אט.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-500 text-sm">אין בקשות שטופלו בתקופה הזו.</p>
        )}

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

      {/* Team + canned replies management */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 font-display text-[14px] font-bold text-ink-700 cursor-pointer"
        >
          <Settings2 size={15} className="text-brand-purple" /> שמות הצוות ותשובות מוכנות
          <ChevronDown
            size={15}
            className={"text-ink-400 transition-transform " + (showSettings ? "rotate-180" : "")}
          />
        </button>
        {showSettings && <InboxSettingsForm teamNames={teamNames} canned={canned} />}
      </div>
    </div>
  );
}

function InboxSettingsForm({ teamNames, canned }: { teamNames: string[]; canned: CannedReply[] }) {
  const [names, setNames] = useState(teamNames.join(", "));
  const [items, setItems] = useState<CannedReply[]>(canned);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="mt-3 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-ink-600">
        שמות הצוות (מופרדים בפסיק) — אלה השמות שנבחרים ב&quot;מי מטפלת?&quot;
        <input
          value={names}
          onChange={(e) => setNames(e.target.value)}
          placeholder="למשל: שרה, שירה"
          className="text-[13px] border border-ink-300 rounded-md px-3 py-2 outline-none focus:border-brand-purple font-normal"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] font-semibold text-ink-600">תשובות מוכנות לשאלות חוזרות</span>
        {items.map((c, i) => (
          <div key={i} className="flex gap-2 items-start flex-wrap">
            <input
              value={c.title}
              onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              placeholder="כותרת קצרה"
              className="w-44 text-[12.5px] border border-ink-300 rounded-md px-2.5 py-1.5 outline-none focus:border-brand-purple"
            />
            <textarea
              value={c.body}
              onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
              placeholder="גוף התשובה"
              rows={2}
              className="flex-1 min-w-[220px] text-[12.5px] border border-ink-300 rounded-md px-2.5 py-1.5 outline-none focus:border-brand-purple"
            />
            <button
              type="button"
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              className="text-[12px] text-ink-400 hover:text-danger cursor-pointer pt-2"
            >
              הסרה
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems([...items, { title: "", body: "" }])}
          className="w-fit text-[12.5px] font-semibold text-brand-purple cursor-pointer"
        >
          + תשובה מוכנה חדשה
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            const fd = new FormData();
            fd.set("team_names", names);
            fd.set("canned_replies", JSON.stringify(items.filter((c) => c.title.trim() && c.body.trim())));
            start(async () => {
              await saveInboxSettings(fd);
              setSaved(true);
              setTimeout(() => setSaved(false), 2500);
            });
          }}
        >
          {pending ? "שומר…" : "שמירה"}
        </Button>
        {saved && <span className="text-[12.5px] font-semibold text-success">נשמר ✓</span>}
      </div>
    </div>
  );
}
