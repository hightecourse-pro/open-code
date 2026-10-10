"use client";

import { useState, useTransition } from "react";
import { Mail, X } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { sendJobCandidatesMail, type JobCandidatesMailResult } from "@/app/(admin)/admin/actions";

export interface MailCandidate {
  id: string;
  name: string;
}

/**
 * The step-4 action of a job that is with the client (the owner, 10/10): one
 * email, in the team's words, to all the candidates at once - the ones
 * submitted to the client by default, or everyone who applied.
 */
export function JobCandidatesMail({ jobId, jobTitle, sent, all }: { jobId: string; jobTitle: string; sent: MailCandidate[]; all: MailCandidate[] }) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<"sent" | "all">(sent.length > 0 ? "sent" : "all");
  const [subject, setSubject] = useState(`עדכון על משרת ${jobTitle}`);
  const [body, setBody] = useState("");
  const [chatCopy, setChatCopy] = useState(true);
  const [result, setResult] = useState<JobCandidatesMailResult | null>(null);
  const [pending, start] = useTransition();
  const recipients = audience === "sent" ? sent : all;

  function send() {
    setResult(null);
    if (!body.trim()) return setResult({ error: "כתבי את תוכן המייל." });
    if (recipients.length === 0) return setResult({ error: "אין מועמדות לשלוח להן." });
    if (!confirm(`לשלוח את המייל ל-${recipients.length} מועמדות${chatCopy ? " (עם עותק בצ'אט של כל אחת)" : ""}?`)) return;
    start(async () => {
      const r = await sendJobCandidatesMail(jobId, { audience, subject, body, chatCopy });
      setResult(r);
      if (!r.error) setBody("");
    });
  }

  if (!open) {
    return (
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <Mail size={14} /> מייל לכל המועמדות ({sent.length > 0 ? sent.length : all.length})
        </Button>
        <span className="text-[12px] text-ink-500">עדכון אחד, במילים שלך, לכל מי שאצל הלקוח - כל אחת מקבלת את העותק שלה.</span>
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
    <div className="mt-3 rounded-[14px] border border-brand-purple/30 bg-tint-purple/30 p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-display font-bold text-[14px] text-ink-1000">✉️ מייל לכל המועמדות</div>
        <button type="button" onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-700 p-1" aria-label="סגירה">
          <X size={16} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5 text-[13px]">
        <label className={cn("flex items-start gap-2 rounded-[10px] border px-3 py-2 cursor-pointer bg-white", audience === "sent" ? "border-brand-purple" : "border-ink-200")}>
          <input type="radio" name="audience" checked={audience === "sent"} onChange={() => setAudience("sent")} className="mt-1" />
          <span>
            <b>המועמדות שהוגשו ללקוח ({sent.length})</b>
            {sent.length > 0 && <span className="block text-[12px] text-ink-600">{sent.map((c) => c.name).join(", ")}</span>}
          </span>
        </label>
        <label className={cn("flex items-start gap-2 rounded-[10px] border px-3 py-2 cursor-pointer bg-white", audience === "all" ? "border-brand-purple" : "border-ink-200")}>
          <input type="radio" name="audience" checked={audience === "all"} onChange={() => setAudience("all")} className="mt-1" />
          <span>
            <b>כל מי שהגישה למשרה ({all.length})</b>
            <span className="block text-[12px] text-ink-600">בלי טיוטות, בלי מי שביטלה ובלי מי שנדחתה.</span>
          </span>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-semibold text-ink-700">נושא</span>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-semibold text-ink-700">תוכן המייל (במילים שלך - כל מועמדת מקבלת אותו עם השם הפרטי שלה בפתיחה)</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={6000}
          placeholder="למשל: המועמדות שלך הועברה ללקוח והוא עדיין בוחן את כל הפניות. נעדכן ברגע שתהיה תשובה…"
          className="w-full rounded-[10px] border border-ink-200 bg-white px-3 py-2 text-[13.5px] leading-relaxed focus:border-brand-purple outline-none"
        />
      </label>
      <label className="flex items-center gap-2 text-[12.5px] text-ink-700">
        <input type="checkbox" checked={chatCopy} onChange={(e) => setChatCopy(e.target.checked)} />
        גם עותק בצ׳אט של כל מועמדת (מופיע אצלה בצ׳אט ובמרכז הסינון, ואפשר לענות שם)
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
          {pending ? "שולחות…" : `שליחה ל-${recipients.length} מועמדות`}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          ביטול
        </Button>
      </div>
    </div>
  );
}
