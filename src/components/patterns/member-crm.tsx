"use client";

import { useState, useTransition } from "react";
import { Star, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveInternalNotes, toggleVip } from "@/app/(admin)/admin/actions";

/**
 * Admin-only CRM chips per member: the VIP star (with a "why" note — VIPs
 * float to the top of candidate filtering) and internal screening notes.
 * Stored in the admin-only member_crm table — members can never read it.
 */
export function MemberCrm({
  id,
  isVip,
  vipReason = null,
  notes,
}: {
  id: string;
  isVip: boolean;
  vipReason?: string | null;
  notes: string | null;
}) {
  const [vip, setVip] = useState(isVip);
  const [reason, setReason] = useState(vipReason ?? "");
  const [vipOpen, setVipOpen] = useState(false);
  const [vipMsg, setVipMsg] = useState<"idle" | "saved" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(notes ?? "");
  const [notesMsg, setNotesMsg] = useState<"idle" | "saved" | "error">("idle");
  const [, start] = useTransition();

  function onStarClick() {
    if (vip) {
      // Removing the star also deletes the saved reason — confirm first.
      if (!window.confirm("להסיר את סימון ה-VIP? הסיבה שנשמרה תימחק.")) return;
      setVip(false);
      setReason("");
      setVipOpen(false);
      setVipMsg("idle");
      start(async () => {
        const res = await toggleVip(id, false);
        if (res.error) {
          setVip(true);
          setVipMsg("error");
        }
      });
    } else {
      setVip(true);
      setVipOpen(true);
      setVipMsg("idle");
      start(async () => {
        const res = await toggleVip(id, true, reason);
        if (res.error) {
          setVip(false);
          setVipOpen(false);
          setVipMsg("error");
        }
      });
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onStarClick}
          title={vip && reason ? `VIP: ${reason}` : "סימון VIP (עדיפות באיתור מועמדות)"}
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border transition-colors",
            vip
              ? "bg-tint-warm border-[#F8D98C] text-[#8C5E0E]"
              : "bg-white border-ink-200 text-ink-500 hover:border-brand-pink"
          )}
        >
          <Star size={12} fill={vip ? "currentColor" : "none"} /> VIP
        </button>
        {vip && (
          <button
            type="button"
            onClick={() => setVipOpen((o) => !o)}
            className="text-[11px] font-semibold text-[#8C5E0E] hover:underline"
          >
            {reason ? "סיבה ✓" : "סיבה?"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border border-ink-200 text-ink-500 hover:border-brand-purple"
        >
          <StickyNote size={12} /> הערות
        </button>
      </div>

      {vipMsg === "error" && !vipOpen && (
        <span className="text-[11px] text-danger">לא נשמר — ודאי שה-SQL האחרון הורץ.</span>
      )}

      {vip && vipOpen && (
        <div className="flex flex-col gap-1 w-56">
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setVipMsg("idle");
            }}
            rows={2}
            placeholder="למה VIP? (למשל: מועמדת מצטיינת, ממליצה חזקה…)"
            className="w-full text-[12px] border border-[#F8D98C] bg-tint-warm/40 rounded-md p-2 outline-none focus:border-brand-purple"
          />
          <div className="flex items-center justify-between">
            {vipMsg === "error" && <span className="text-[11px] text-danger">לא נשמר</span>}
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  const res = await toggleVip(id, true, reason);
                  setVipMsg(res.error ? "error" : "saved");
                })
              }
              className="ms-auto text-[11px] font-semibold text-[#8C5E0E]"
            >
              {vipMsg === "saved" ? "נשמר ✓" : "שמירת סיבה"}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-1 w-56">
          <textarea
            value={val}
            onChange={(e) => {
              setVal(e.target.value);
              setNotesMsg("idle");
            }}
            rows={3}
            placeholder="הערות פנימיות לסינון…"
            className="w-full text-[12px] border border-ink-300 rounded-md p-2 outline-none focus:border-brand-purple"
          />
          <div className="flex items-center justify-between">
            {notesMsg === "error" && <span className="text-[11px] text-danger">לא נשמר</span>}
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  const res = await saveInternalNotes(id, val);
                  setNotesMsg(res.error ? "error" : "saved");
                })
              }
              className="ms-auto text-[11px] font-semibold text-brand-purple"
            >
              {notesMsg === "saved" ? "נשמר ✓" : "שמירה"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
