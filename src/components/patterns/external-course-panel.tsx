import { ExternalLink, KeyRound, ShieldAlert, User } from "lucide-react";
import { CopyTextButton } from "@/components/patterns/copy-text-button";
import type { ExternalAccessRow } from "@/lib/course-external";

/**
 * The material block of an external course (the owner, 11/10): the link and
 * the shared login, under a notice that cannot be missed - "אין להעביר את
 * הקישור והסיסמה לאף אחת אחרת". Rendered on the server, only for a member
 * whose course this is.
 */
export function ExternalCoursePanel({ rows }: { rows: ExternalAccessRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[18px] border-2 border-[#E0418D] bg-[#FDE7EE] p-4 flex gap-3 items-start" role="note">
        <ShieldAlert size={24} className="text-[#B81E6E] shrink-0 mt-0.5" aria-hidden />
        <div className="text-[14px] leading-relaxed text-ink-1000">
          <div className="font-display font-black text-[17px] text-[#B81E6E]">חשוב: לא מעבירות הלאה</div>
          <p className="mt-1">
            <b>הקישור ופרטי הכניסה כאן אישיים לך כחברת קהילה. אסור להעביר אותם לאף אחת אחרת - לא את הקישור ולא את הסיסמה.</b>{" "}
            הגישה ניתנה לקהילה שלנו על ידי המכללה לחברות בלבד, והעברה שלה תסגור אותה לכולן.
          </p>
        </div>
      </div>

      <p className="text-[13px] text-ink-600">
        הקורס הזה מתארח באתר חיצוני, לא בדרייב. נכנסים עם הקישור ופרטי הכניסה שכאן, בלי צורך בחשבון גוגל.
      </p>

      {rows.length === 0 ? (
        <div className="bg-white border border-ink-200 rounded-[16px] p-5 text-sm text-ink-500">פרטי הכניסה יתווספו בקרוב 💜</div>
      ) : (
        rows.map((r) => (
          <section key={r.id} className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm flex flex-col gap-3">
            <h3 className="font-display font-bold text-[15.5px] text-ink-1000">{r.label}</h3>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start font-display font-semibold text-[13.5px] px-4 py-2 rounded-md bg-brand-gradient text-white"
            >
              לכניסה לקורס <ExternalLink size={14} />
            </a>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13.5px]">
              {r.username && (
                <div className="flex items-center gap-2 bg-ink-50 border border-ink-100 rounded-md px-3 py-2 min-w-0">
                  <User size={14} className="text-brand-purple shrink-0" aria-hidden />
                  <span className="text-ink-600 shrink-0">שם משתמש:</span>
                  <code dir="ltr" className="font-mono text-[13px] text-ink-1000 select-all truncate">
                    {r.username}
                  </code>
                  <span className="ms-auto">
                    <CopyTextButton text={r.username} />
                  </span>
                </div>
              )}
              {r.password && (
                <div className="flex items-center gap-2 bg-ink-50 border border-ink-100 rounded-md px-3 py-2 min-w-0">
                  <KeyRound size={14} className="text-brand-purple shrink-0" aria-hidden />
                  <span className="text-ink-600 shrink-0">סיסמה:</span>
                  <code dir="ltr" className="font-mono text-[13px] text-ink-1000 select-all truncate">
                    {r.password}
                  </code>
                  <span className="ms-auto">
                    <CopyTextButton text={r.password} />
                  </span>
                </div>
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
