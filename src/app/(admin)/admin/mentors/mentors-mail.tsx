"use client";

import { useState, useTransition } from "react";
import { Mail, X } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
import { sendMentorsMail, type MentorsMailResult } from "@/app/(admin)/admin/actions";

export interface MailMentor {
  id: string;
  name: string;
}

/**
 * One email, in the team's words, to every mentor the list currently shows
 * (the owner, 14/10: "לסנן לפי קריטריונים ולשלוח מייל שאני אנסח לכל המסוננות").
 * Each mentor gets her own copy with her first name; nobody sees the others.
 */
export function MentorsMail({ recipients }: { recipients: MailMentor[] }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [chatCopy, setChatCopy] = useState(true);
  const [result, setResult] = useState<MentorsMailResult | null>(null);
  const [pending, start] = useTransition();

  function send() {
    setResult(null);
    if (!subject.trim()) return setResult({ error: "כתבי נושא למייל." });
    if (!body.trim()) return setResult({ error: "כתבי את תוכן המייל." });
    if (recipients.length === 0) return setResult({ error: "אין מנטוריות ברשימה המסוננת." });
    if (!confirm(`לשלוח את המייל ל-${recipients.length} מנטוריות${chatCopy ? " (עם עותק בצ'אט של כל אחת)" : ""}?`)) return;
    start(async () => {
      const r = await sendMentorsMail({ mentorIds: recipients.map((m) => m.id), subject, body, chatCopy });
      setResult(r);
      if (!r.error) setBody("");
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <Button type="button" size="sm" disabled={recipients.length === 0} onClick={() => setOpen(true)}>
          <Mail size={14} /> מייל לכל המסוננות ({recipients.length})
        </Button>
        <span className="text-[12px] text-ink-500">מייל אחד, במילים שלך, לכל מי שעומדת בסינון - כל אחת מקבלת את העותק שלה.</span>
        {result && !result.error && (
          <span className="text-[12px] font-semibold text-success">
            ✓ נשלח ל-{result.sent}
            {result.skipped ? ` · ${result.skipped} נחסמו (מגן סטייג'ינג)` : ""}
            {result.failed ? ` · ${result.failed} נכשלו` : ""}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-brand-purple/30 bg-tint-purple/30 p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-display font-bold text-[14px] text-ink-1000">✉️ מייל לכל המסוננות ({recipients.length})</div>
        <button type="button" onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-700 p-1" aria-label="סגירה">
          <X size={16} />
        </button>
      </div>
      <p className="text-[12px] text-ink-600 leading-relaxed">
        <b>נמענות:</b> {recipients.map((m) => m.name).join(", ")}
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-semibold text-ink-700">נושא</span>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="למשל: מנטוריות להאקתון 2026 - צריכות אותך" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-semibold text-ink-700">תוכן המייל (במילים שלך - כל מנטורית מקבלת אותו עם השם הפרטי שלה בפתיחה)</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          maxLength={6000}
          placeholder="למשל: בהאקתון הקרוב נצטרך מנטוריות שילוו צוות לאורך השבוע. אם זה מתאים לך - עני לי כאן…"
          className="w-full rounded-[10px] border border-ink-200 bg-white px-3 py-2 text-[13.5px] leading-relaxed focus:border-brand-purple outline-none"
        />
      </label>
      <label className="flex items-center gap-2 text-[12.5px] text-ink-700">
        <input type="checkbox" checked={chatCopy} onChange={(e) => setChatCopy(e.target.checked)} />
        גם עותק בצ׳אט של כל מנטורית (מופיע אצלה בצ׳אט, ואפשר לענות שם)
      </label>
      {result?.error && <Alert variant="danger">{result.error}</Alert>}
      {result && !result.error && (
        <Alert variant="success">
          נשלח ל-{result.sent} מתוך {result.total}
          {result.skipped ? ` · ${result.skipped} לא נשלחו (מגן סטייג'ינג - כתובת מחוץ לרשימה)` : ""}
          {result.failed ? ` · ${result.failed} נכשלו` : ""}
          {result.names?.length ? ` · ${result.names.join(", ")}` : ""}
        </Alert>
      )}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={pending || recipients.length === 0} onClick={send}>
          {pending ? "שולחות…" : `שליחה ל-${recipients.length} מנטוריות`}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          ביטול
        </Button>
      </div>
    </div>
  );
}
