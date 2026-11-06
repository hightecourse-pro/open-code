"use client";

import { useActionState, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { MemberPicker } from "../shares/member-picker";
import { FeedbackNoteItem } from "@/components/patterns/hackathon-feedback-notes";
import { AUDIENCE_LABELS, KINDS, KIND_LABELS, SOURCES, SOURCE_LABELS, type FeedbackAudience, type FeedbackNote } from "@/lib/hackathon-feedback-notes";
import { addFeedbackNote, setFeedbackNoteHiddenAction } from "./actions";

const ORDER: FeedbackAudience[] = ["submitter", "participant", "other"];

/**
 * ״משובים על ההאקתון״ in the admin's hackathon page (the owner, 6.11): every quote by
 * audience - מגישות / משתתפות / אחרות - each with its source; a hide/restore per quote,
 * and a form to type one that came by phone or mail.
 */
export function FeedbackNotesAdmin({ notes }: { notes: FeedbackNote[] }) {
  const [showHidden, setShowHidden] = useState(false);
  const [state, formAction, pending] = useActionState(addFeedbackNote, { error: null as string | null, ok: false });
  const visible = notes.filter((n) => showHidden || !n.hiddenAt);
  return (
    <div className="flex flex-col gap-4" data-testid="feedback-notes-admin" data-total={notes.filter((n) => !n.hiddenAt).length}>
      <div className="flex items-center gap-3 flex-wrap text-[13px] text-ink-600">
        {ORDER.map((a) => (
          <span key={a}>
            {AUDIENCE_LABELS[a]}: <b className="text-ink-900">{notes.filter((n) => n.audience === a && !n.hiddenAt).length}</b>
          </span>
        ))}
        <label className="ms-auto inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> להציג גם מוסתרים ({notes.filter((n) => n.hiddenAt).length})
        </label>
      </div>

      {ORDER.map((a) => {
        const list = visible.filter((n) => n.audience === a);
        if (list.length === 0) return null;
        return (
          <section key={a} data-testid="feedback-notes-group" data-audience={a}>
            <h4 className="font-display font-bold text-[15px] text-ink-1000 mb-2">
              {AUDIENCE_LABELS[a]} <span className="text-[12.5px] font-semibold text-ink-500">· {list.length}</span>
            </h4>
            <ul className="flex flex-col gap-2.5">
              {list.map((n) => (
                <div key={n.id} className="relative">
                  <FeedbackNoteItem note={n} withName />
                  <form action={setFeedbackNoteHiddenAction} className="absolute top-2 left-3">
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="hidden" value={n.hiddenAt ? "0" : "1"} />
                    <button type="submit" className="text-[11.5px] text-ink-400 hover:text-ink-800 hover:underline" data-testid="feedback-note-hide">
                      {n.hiddenAt ? "להחזיר" : "להסתיר"}
                    </button>
                  </form>
                </div>
              ))}
            </ul>
          </section>
        );
      })}

      <form action={formAction} className="rounded-[14px] border border-ink-200 bg-ink-50 p-4 flex flex-col gap-3" data-testid="feedback-note-form">
        <div className="font-display font-bold text-[14.5px] text-ink-1000">להוסיף משוב ששמעת בטלפון או קיבלת במייל</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12.5px] text-ink-600">חברה בקהילה (אם יש)</label>
            <MemberPicker name="profile_id" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12.5px] text-ink-600" htmlFor="fb-name">
              או שם חופשי (שופטת, אורחת…)
            </label>
            <input id="fb-name" name="display_name" className="rounded-md border border-ink-300 px-3 py-2 text-[13.5px]" placeholder="שם" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12.5px] text-ink-600" htmlFor="fb-source">
              מקור
            </label>
            <select id="fb-source" name="source" defaultValue="manual" className="rounded-md border border-ink-300 px-3 py-2 text-[13.5px] bg-white">
              {SOURCES.filter((s) => !["submission", "review"].includes(s)).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12.5px] text-ink-600" htmlFor="fb-kind">
                סוג
              </label>
              <select id="fb-kind" name="kind" defaultValue="praise" className="rounded-md border border-ink-300 px-3 py-2 text-[13.5px] bg-white">
                {KINDS.filter((k) => k !== "reflection").map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12.5px] text-ink-600" htmlFor="fb-date">
                תאריך
              </label>
              <input id="fb-date" type="date" name="written_at" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-md border border-ink-300 px-3 py-2 text-[13.5px] bg-white" />
            </div>
          </div>
        </div>
        <textarea name="body" required rows={3} className="rounded-md border border-ink-300 px-3 py-2 text-[13.5px]" placeholder="המשוב, במילים שלה" data-testid="feedback-note-body" />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending} data-testid="feedback-note-submit">
            {pending ? "רגע…" : "להוסיף"}
          </Button>
          {state.error && <Alert variant="danger">{state.error}</Alert>}
          {state.ok && !pending && <span className="text-[12.5px] text-success">נוסף.</span>}
        </div>
      </form>
    </div>
  );
}
