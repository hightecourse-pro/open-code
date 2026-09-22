"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ShieldAlert, Trash2, UserCheck } from "lucide-react";
import { Badge, Button, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { approveExternalPayment, assignExternalPayment, deleteExternalPayment } from "./actions";

export interface ExternalPaymentRow {
  id: string;
  client_name: string | null;
  email: string | null;
  phone: string | null;
  amount_agorot: number | null;
  provider_payment_id: string;
  needs_review: boolean;
  created_at: string;
  claimed_at: string | null;
  claimedName: string | null;
}

export interface MemberOption {
  id: string;
  label: string;
}

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  timeZone: "Asia/Jerusalem",
});

function waitingDays(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function AssignControl({ ids, members }: { ids: string[]; members: MemberOption[] }) {
  const [profileId, setProfileId] = useState("");
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-1.5">
      <Select
        value={profileId}
        onChange={(e) => setProfileId(e.target.value)}
        className="w-auto min-w-[170px] py-1.5 text-[12.5px]"
        aria-label="שיוך לחברה"
      >
        <option value="">שייכי לחברה…</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        disabled={!profileId || pending}
        onClick={() => {
          const name = members.find((m) => m.id === profileId)?.label ?? "";
          const what = ids.length === 1 ? "התשלום" : `${ids.length} החיובים`;
          if (!window.confirm(`לשייך את ${what} ל-${name} ולהפעיל לה מנוי?`)) return;
          start(async () => {
            // Her charges travel together - one שיוך covers the whole group.
            for (const id of ids) await assignExternalPayment(id, profileId);
          });
        }}
      >
        {pending ? "משייכת…" : "שיוך ✓"}
      </Button>
    </span>
  );
}

/** One woman's waiting charges, folded into a single row (the owner, 14/9:
 *  "שהכל יראה מסודר בלי כפילויות"). */
interface WaitingGroup {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  rows: ExternalPaymentRow[];
  totalAgorot: number;
  firstAt: string;
  lastAt: string;
}

export function ExternalPaymentsList({
  waiting,
  claimed,
  members,
}: {
  waiting: ExternalPaymentRow[];
  claimed: ExternalPaymentRow[];
  members: MemberOption[];
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDelete, start] = useTransition();

  // One row per woman: all her waiting charges folded together, keyed by the
  // keva's email (name as fallback). needs_review rows stay individual - each
  // must be approved on its own merits.
  const reviewRows = waiting.filter((p) => p.needs_review);
  // Plain computation, no memo - a couple dozen rows, and the compiler
  // handles the rest.
  const groups: WaitingGroup[] = (() => {
    const m = new Map<string, WaitingGroup>();
    for (const p of waiting) {
      if (p.needs_review) continue;
      const key = (p.email ?? p.client_name ?? p.id).toLowerCase().trim();
      let g = m.get(key);
      if (!g) {
        g = {
          key,
          name: p.client_name ?? "ללא שם",
          email: p.email,
          phone: p.phone,
          rows: [],
          totalAgorot: 0,
          firstAt: p.created_at,
          lastAt: p.created_at,
        };
        m.set(key, g);
      }
      g.rows.push(p);
      g.totalAgorot += p.amount_agorot ?? 0;
      if (p.created_at < g.firstAt) g.firstAt = p.created_at;
      if (p.created_at > g.lastAt) g.lastAt = p.created_at;
      if (!g.name || g.name === "ללא שם") g.name = p.client_name ?? g.name;
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "he"));
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">
          מחכות לבעלים ({groups.length + reviewRows.length})
        </h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          תשלומים שנקלטו בלי חשבון תואם - שורה אחת לכל משלמת, גם כשיש לה כמה חיובים. ברגע שהיא
          נרשמת עם אותו מייל ההפעלה אוטומטית; שילמה במייל אחד ונרשמה באחר? שייכי ידנית.
        </p>
        <div className="flex flex-col">
          {reviewRows.map((p) => (
            <div key={p.id} className="py-3 border-b border-ink-100 last:border-b-0 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <div className="font-medium text-ink-900 flex items-center gap-2 flex-wrap">
                  {p.client_name ?? "ללא שם"}
                  <span className="font-display font-bold text-brand-purple">
                    {((p.amount_agorot ?? 0) / 100).toFixed(0)} ₪
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-tint-warm border border-[#F0DCA8] text-[#8C5E0E] px-2 py-0.5 text-[11px] font-bold">
                    <ShieldAlert size={11} /> ממתין לאישור - מקור לא מזוהה
                  </span>
                </div>
                <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2.5 flex-wrap">
                  {p.email && <span dir="ltr">{p.email}</span>}
                  <span className="text-ink-400" dir="ltr">{p.provider_payment_id}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (
                    !window.confirm(
                      "לאשר את התשלום? ודאי קודם שהוא מופיע בקונסולת נדרים פלוס. אחרי האישור הוא יתנהג כתשלום רגיל (הפעלה אוטומטית לפי מייל)."
                    )
                  )
                    return;
                  start(() => void approveExternalPayment(p.id));
                }}
              >
                אישור התשלום ✓
              </Button>
            </div>
          ))}
          {groups.map((g) => {
            const days = waitingDays(g.firstAt);
            return (
              <div key={g.key} className="py-3 border-b border-ink-100 last:border-b-0 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="font-medium text-ink-900 flex items-center gap-2 flex-wrap">
                    {g.name}
                    <span className="font-display font-bold text-brand-purple">
                      {(g.totalAgorot / 100).toFixed(0)} ₪
                    </span>
                    {g.rows.length > 1 && (
                      <Badge variant="purple">{g.rows.length} חיובים</Badge>
                    )}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2.5 flex-wrap">
                    {g.email && <span dir="ltr">{g.email}</span>}
                    {g.phone && <span dir="ltr">{g.phone}</span>}
                    <span className="tabular-nums">
                      מחכה {days === 0 ? "מהיום" : days === 1 ? "יום" : `${days} ימים`}
                      {" · "}
                      {g.rows.length > 1
                        ? `${DATE_HE.format(new Date(g.firstAt))}–${DATE_HE.format(new Date(g.lastAt))}`
                        : DATE_HE.format(new Date(g.firstAt))}
                    </span>
                    <span className="text-ink-400" dir="ltr">
                      {g.rows.map((r) => r.provider_payment_id).join(" · ")}
                    </span>
                  </div>
                </div>
                <AssignControl ids={g.rows.map((r) => r.id)} members={members} />
                <button
                  type="button"
                  title="מחיקה"
                  disabled={pendingDelete}
                  onClick={() => {
                    const what =
                      g.rows.length === 1 ? "התשלום" : `${g.rows.length} החיובים`;
                    if (
                      !window.confirm(
                        `למחוק את ${what} של ${g.name}? מוחקים רק תשלום שזוכה או שגוי - הפעולה אינה ניתנת לביטול.`
                      )
                    )
                      return;
                    start(async () => {
                      for (const r of g.rows) await deleteExternalPayment(r.id);
                    });
                  }}
                  className="text-ink-300 hover:text-danger p-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
          {groups.length === 0 && reviewRows.length === 0 && (
            <p className="text-ink-500 text-sm py-3">אין תשלומים שמחכים - הכול משויך 💜</p>
          )}
        </div>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="w-full flex items-center gap-2 font-display text-base font-bold text-ink-1000 cursor-pointer"
        >
          <ChevronDown size={16} className={cn("transition-transform", !historyOpen && "-rotate-90")} />
          שויכו ({claimed.length})
        </button>
        {historyOpen && (
          <div className="flex flex-col mt-2">
            {claimed.map((p) => (
              <div key={p.id} className="py-2.5 border-b border-ink-100 last:border-b-0 flex items-center gap-3 flex-wrap text-sm">
                <UserCheck size={15} className="text-success shrink-0" />
                <span className="font-medium text-ink-900">{p.client_name ?? p.email ?? "-"}</span>
                <span className="font-display font-bold text-ink-700">
                  {((p.amount_agorot ?? 0) / 100).toFixed(0)} ₪
                </span>
                <Badge variant="mint">הופעל{p.claimedName ? ` · ${p.claimedName}` : ""}</Badge>
                <span className="text-xs text-ink-400 tabular-nums ms-auto">
                  {p.claimed_at ? DATE_HE.format(new Date(p.claimed_at)) : ""}
                </span>
              </div>
            ))}
            {claimed.length === 0 && <p className="text-ink-500 text-sm py-3">עוד לא שויכו תשלומים.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
