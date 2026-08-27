"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ShieldAlert, Trash2, UserCheck } from "lucide-react";
import { Badge, Button, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ConfirmActionButton } from "@/components/patterns/confirm-action-button";
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

function AssignControl({ id, members }: { id: string; members: MemberOption[] }) {
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
          if (!window.confirm(`לשייך את התשלום ל-${name} ולהפעיל לה מנוי?`)) return;
          start(() => void assignExternalPayment(id, profileId));
        }}
      >
        {pending ? "משייכת…" : "שיוך ✓"}
      </Button>
    </span>
  );
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
  const [, start] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">
          מחכות לבעלים ({waiting.length})
        </h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          תשלומים שנקלטו בלי חשבון תואם. ברגע שהיא נרשמת עם אותו מייל — ההפעלה אוטומטית; שילמה
          במייל אחד ונרשמה באחר? שייכי ידנית.
        </p>
        <div className="flex flex-col">
          {waiting.map((p) => {
            const days = waitingDays(p.created_at);
            return (
              <div key={p.id} className="py-3 border-b border-ink-100 last:border-b-0 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="font-medium text-ink-900 flex items-center gap-2 flex-wrap">
                    {p.client_name ?? "ללא שם"}
                    <span className="font-display font-bold text-brand-purple">
                      {((p.amount_agorot ?? 0) / 100).toFixed(0)} ₪
                    </span>
                    {p.needs_review && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-tint-warm border border-[#F0DCA8] text-[#8C5E0E] px-2 py-0.5 text-[11px] font-bold">
                        <ShieldAlert size={11} /> ממתין לאישור — מקור לא מזוהה
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2.5 flex-wrap">
                    {p.email && <span dir="ltr">{p.email}</span>}
                    {p.phone && <span dir="ltr">{p.phone}</span>}
                    <span className="tabular-nums">
                      התקבל {DATE_HE.format(new Date(p.created_at))} · מחכה{" "}
                      {days === 0 ? "מהיום" : days === 1 ? "יום" : `${days} ימים`}
                    </span>
                    <span className="text-ink-400" dir="ltr">
                      {p.provider_payment_id}
                    </span>
                  </div>
                </div>
                {p.needs_review ? (
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
                ) : (
                  <AssignControl id={p.id} members={members} />
                )}
                <ConfirmActionButton
                  action={deleteExternalPayment.bind(null, p.id)}
                  message={`למחוק את התשלום של ${p.client_name ?? "ללא שם"} (${p.provider_payment_id})? מוחקים רק תשלום שזוכה או שגוי — הפעולה אינה ניתנת לביטול.`}
                  title="מחיקה"
                  className="text-ink-300 hover:text-danger p-1.5"
                >
                  <Trash2 size={15} />
                </ConfirmActionButton>
              </div>
            );
          })}
          {waiting.length === 0 && (
            <p className="text-ink-500 text-sm py-3">אין תשלומים שמחכים — הכול משויך 💜</p>
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
                <span className="font-medium text-ink-900">{p.client_name ?? p.email ?? "—"}</span>
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
