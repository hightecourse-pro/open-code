"use client";

import { useState, useTransition } from "react";
import { H } from "../theme";
import { saveTagsSettingsAction, testTagsConnectionAction, type TagsConnectionResult, type TagsSaveResult } from "./actions";

/*
  מערכת הדפסת תגים - the admin's side (the owner, 27/10): which Google Sheet
  holds the participants, which tab, and the entry code of /tags. The sheet is
  read and written by the Drive service account, so the card also says whom
  to share the sheet with and where the Sheets API gets switched on, and has a
  ״בדיקת חיבור״ that reports what Google answers, in Hebrew.
*/
export interface TagsSettingsView {
  sheetUrl: string;
  tab: string;
  code: string;
  serviceAccountEmail: string | null;
  enableApiUrl: string;
}

const fieldCls = "w-full bg-white px-3 py-2.5 text-[15px] outline-none";
const fieldStyle = { border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink } as const;
const labelCls = "block text-[13px] font-bold";

export function TagsSettings({ initial }: { initial: TagsSettingsView }) {
  const [sheet, setSheet] = useState(initial.sheetUrl);
  const [tab, setTab] = useState(initial.tab);
  const [code, setCode] = useState(initial.code);
  const [saved, setSaved] = useState<TagsSaveResult | null>(null);
  /** How many saves answered - the check script waits for the number to move. */
  const [saveCount, setSaveCount] = useState(0);
  const [test, setTest] = useState<TagsConnectionResult | null>(null);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(null);
    setTest(null);
    startSave(async () => {
      try {
        setSaved(await saveTagsSettingsAction({ sheet, tab, code }));
      } catch {
        setSaved({ ok: false, error: "השמירה נכשלה - נסי שוב." });
      }
      setSaveCount((n) => n + 1);
    });
  };

  const check = () => {
    setTest(null);
    startTest(async () => {
      try {
        setTest(await testTagsConnectionAction());
      } catch {
        setTest({ ok: false, error: "הבדיקה נכשלה - נסי שוב.", hint: "unknown" });
      }
    });
  };

  return (
    <section id="tags" className="bg-white p-5 sm:p-6" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }} data-testid="tags-settings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-black" style={{ color: H.navy }}>
            מערכת הדפסת תגים
          </h2>
          <span className="mt-1.5 block h-[4px] w-16" style={{ background: H.yellow, borderRadius: 2 }} />
        </div>
        <a href="/tags" target="_blank" rel="noreferrer" className="text-[13.5px] font-bold underline" style={{ color: H.navy }} data-testid="tags-open">
          לפתוח את מסך ההדפסה
        </a>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed" style={{ color: H.muted }}>
        המשתתפות נקראות מגיליון גוגל (לשונית עם העמודות ת.ז., פרטי, משפחה, שם לתג, תפקיד, קורס, משרד, הודפס); אחרי כל הדפסה נכתב ״כן״ בעמודת הודפס. כדי שזה יעבוד:
      </p>
      <ol className="mt-2 list-decimal space-y-1 pr-5 text-[14px]" style={{ color: H.ink }}>
        <li>
          שתפי את הגיליון כעורכת עם חשבון השירות:{" "}
          {initial.serviceAccountEmail ? (
            <code dir="ltr" className="rounded px-1.5 py-0.5 text-[13px]" style={{ background: H.row }} data-testid="tags-sa-email">
              {initial.serviceAccountEmail}
            </code>
          ) : (
            <span style={{ color: H.red }}>חשבון השירות לא מוגדר בסביבה הזו</span>
          )}
        </li>
        <li>
          הפעילי פעם אחת את Google Sheets API בפרויקט של חשבון השירות:{" "}
          <a href={initial.enableApiUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: H.navy }} dir="ltr">
            הפעלה בקונסולת גוגל
          </a>
        </li>
        <li>הדביקי כאן את הקישור לגיליון, בחרי קוד כניסה, שמרי ולחצי ״בדיקת חיבור״.</li>
      </ol>

      <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-[1fr_180px_160px]">
        <div className="space-y-1.5">
          <label htmlFor="tags-sheet" className={labelCls} style={{ color: H.navy }}>
            קישור לגיליון
          </label>
          <input id="tags-sheet" dir="ltr" value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className={fieldCls} style={fieldStyle} data-testid="tags-sheet" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tags-tab" className={labelCls} style={{ color: H.navy }}>
            לשונית
          </label>
          <input id="tags-tab" value={tab} onChange={(e) => setTab(e.target.value)} className={fieldCls} style={fieldStyle} data-testid="tags-tab" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tags-code-field" className={labelCls} style={{ color: H.navy }}>
            קוד כניסה
          </label>
          <input id="tags-code-field" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" className={fieldCls} style={fieldStyle} data-testid="tags-code-field" />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <button type="submit" disabled={saving} className="px-5 py-2.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: H.navy, borderRadius: 10 }} data-testid="tags-save">
            {saving ? "שומרת..." : "שמירה"}
          </button>
          <button type="button" onClick={check} disabled={testing} className="px-5 py-2.5 text-[15px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: H.yellow, color: H.navy, borderRadius: 10 }} data-testid="tags-test">
            {testing ? "בודקת..." : "בדיקת חיבור"}
          </button>
          {saved && (
            <span className="text-[14px] font-semibold" style={{ color: saved.ok ? H.green : H.red }} data-testid="tags-saved" data-n={saveCount}>
              {saved.ok ? "נשמר ✓" : saved.error}
            </span>
          )}
        </div>
      </form>

      {test && (
        <div className="mt-4 px-4 py-3 text-[14px] leading-relaxed" style={{ background: test.ok ? "#E9F6EE" : "#FBEAE8", color: test.ok ? H.green : H.red, borderRadius: 10 }} data-testid="tags-test-result" data-ok={test.ok ? "1" : "0"}>
          {test.ok ? (
            <>
              <b>החיבור עובד.</b> {test.rows} שורות בלשונית ״{tab}״ (לשוניות בגיליון: {test.tabs.join(", ")}).
              {test.missing.length > 0 ? <span style={{ color: H.red }}> חסרות העמודות: {test.missing.join(", ")}.</span> : " כל העמודות הנדרשות קיימות."}
            </>
          ) : (
            test.error
          )}
        </div>
      )}
    </section>
  );
}
