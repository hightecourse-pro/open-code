import Link from "next/link";
import { Briefcase, ClipboardCheck, Trophy } from "lucide-react";
import { Badge } from "@/components/ui";
import { ADMIN_MARK_LABEL, APPLICATION_STATUS_LABEL, type MemberApplication, type MemberCoordinatorReview, type MemberHackathon } from "@/lib/member-overview";

const DMY = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Jerusalem" });
const MARK_CHIP: Record<string, string> = {
  optional: "bg-tint-warm text-[#8C5E0E] border border-[#F0DCA8]",
  not_fit: "bg-danger-bg text-[#A8254B] border border-[#F2BBC8]",
  approved: "bg-tint-mint text-[#0F6E4A] border border-[#BFE4D1]",
};

/**
 * הגשות למשרות (the owner, 25/10): every job she applied to, what the team
 * marked, whether she was sent to the employer in the end - unmistakable -
 * and her answers to the job's questions, one click away. Server-rendered.
 */
export function MemberApplications({ rows, note }: { rows: MemberApplication[]; note: string | null }) {
  const sent = rows.filter((r) => r.sentToClientAt).length;
  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3" data-testid="member-applications">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h3 className="font-display text-base font-bold flex items-center gap-1.5">
          <Briefcase size={16} className="text-brand-purple" /> הגשות למשרות ({rows.length})
        </h3>
        {rows.length > 0 && (
          <span className="text-[12.5px] text-ink-500">
            הוגשה למעסיק ב-<b className="text-ink-900">{sent}</b> מהן
          </span>
        )}
      </div>
      {note && (
        <p className="text-[12.5px] text-ink-700 bg-tint-warm/60 border border-[#F0DCA8] rounded-[10px] px-3 py-2" data-testid="member-note-echo">
          <b>ההערה הפנימית שלך</b> (מופיעה לצוות בכל ההגשות שלה): {note}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-500">לא הגישה לאף משרה עדיין.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink-100">
          {rows.map((a) => (
            <li key={a.id} className="py-3 flex flex-col gap-1.5" data-testid="member-application" data-sent={a.sentToClientAt ? "1" : "0"}>
              <div className="flex items-start gap-2 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <Link href={`/admin/jobs/${a.jobId}`} target="_blank" rel="noopener" className="font-semibold text-[14px] text-ink-1000 hover:text-brand-purple hover:underline">
                    {a.jobTitle}
                  </Link>
                  <span className="text-[12.5px] text-ink-500"> · {a.company}</span>
                  <div className="text-[12px] text-ink-500 mt-0.5">
                    הגישה {DMY.format(new Date(a.submittedAt))}
                    {a.editedAt ? ` · ערכה ${DMY.format(new Date(a.editedAt))}` : ""}
                    {a.jobStatus === "closed" ? " · המשרה נסגרה" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="gray">{APPLICATION_STATUS_LABEL[a.status] ?? a.status}</Badge>
                  {a.adminMark && (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-bold ${MARK_CHIP[a.adminMark] ?? "bg-ink-100 text-ink-700"}`} title={a.adminMarkReason ?? undefined}>
                      {ADMIN_MARK_LABEL[a.adminMark] ?? a.adminMark}
                    </span>
                  )}
                  {a.sentToClientAt ? (
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-black text-white bg-success" data-testid="sent-to-client">
                      ✓ הוגשה למעסיק {DMY.format(new Date(a.sentToClientAt))}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-bold text-ink-600 bg-ink-100 border border-ink-200">לא הוגשה למעסיק</span>
                  )}
                  {a.interviewMarked && <Badge variant="pink">המעסיק ביקש ראיון</Badge>}
                </div>
              </div>
              {(a.note || a.clientNote || a.adminMarkReason) && (
                <div className="text-[12.5px] text-ink-700 flex flex-col gap-0.5">
                  {a.adminMarkReason && (
                    <div>
                      <b>סיבת הסימון:</b> {a.adminMarkReason}
                    </div>
                  )}
                  {a.note && (
                    <div>
                      <b>הערת הצוות להגשה:</b> {a.note}
                    </div>
                  )}
                  {a.clientNote && (
                    <div>
                      <b>הערת המעסיק:</b> {a.clientNote}
                    </div>
                  )}
                </div>
              )}
              {a.answers.length > 0 && (
                <details className="group">
                  <summary className="list-none cursor-pointer text-[12.5px] font-bold text-brand-purple hover:underline [&::-webkit-details-marker]:hidden" data-testid="application-answers-toggle">
                    התשובות שלה לשאלות המשרה ({a.answers.length}) <span className="text-ink-400 font-normal group-open:hidden">לפתיחה</span>
                  </summary>
                  <dl className="mt-2 flex flex-col gap-2 rounded-[12px] bg-ink-50 border border-ink-100 px-3 py-2.5">
                    {a.answers.map((qa, i) => (
                      <div key={i}>
                        <dt className="text-[12px] font-semibold text-ink-600">{qa.label}</dt>
                        <dd className="text-[13px] text-ink-900 whitespace-pre-wrap leading-relaxed">{qa.answer}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** חוות דעת הרכזת (the owner, 25/10): what her institution's coordinator wrote - plain and first. */
export function MemberCoordinatorOpinion({ reviews }: { reviews: MemberCoordinatorReview[] }) {
  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3" data-testid="member-coordinator">
      <h3 className="font-display text-base font-bold flex items-center gap-1.5">
        <ClipboardCheck size={16} className="text-brand-purple" /> חוות דעת הרכזת
      </h3>
      {reviews.length === 0 ? (
        <p className="text-[13px] text-ink-500">אין עדיין חוות דעת של רכזת על החברה הזו.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-[12px] border border-ink-100 bg-ink-50 px-3.5 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap text-[12.5px]">
                <b className="text-ink-900">{r.coordinator}</b>
                <span className="text-ink-500">עודכן {DMY.format(new Date(r.updatedAt))}</span>
                {(r.talentLabel || r.talent !== null) && <Badge variant="purple">כישרון: {r.talentLabel ?? `${r.talent}/5`}</Badge>}
                {(r.communicationLabel || r.communication !== null) && <Badge variant="indigo">תקשורת: {r.communicationLabel ?? `${r.communication}/5`}</Badge>}
                {r.foundJob !== null && <Badge variant={r.foundJob ? "mint" : "gray"}>{r.foundJob ? `מצאה עבודה${r.foundJobPlace ? ` - ${r.foundJobPlace}` : ""}` : "עדיין מחפשת"}</Badge>}
              </div>
              {r.note ? <p className="text-[13.5px] text-ink-900 whitespace-pre-wrap leading-relaxed">{r.note}</p> : <p className="text-[12.5px] text-ink-500">בלי הערה במילים - רק הדירוגים.</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** האקתון (the owner, 25/10): if she submitted - the challenge, the team, and the links the judges open. */
export function MemberHackathonCard({ h }: { h: MemberHackathon | null }) {
  if (!h) return null;
  const link = "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-bold text-brand-purple bg-tint-purple hover:opacity-90";
  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-2.5" data-testid="member-hackathon" data-submitted={h.submittedAt ? "1" : "0"}>
      <h3 className="font-display text-base font-bold flex items-center gap-1.5">
        <Trophy size={16} className="text-brand-pink-deep" /> האקתון AI 2026
      </h3>
      <div className="text-[13px] text-ink-800 flex items-center gap-2 flex-wrap">
        <span>
          אתגר <b>{h.challengeShort}</b> {h.challengeEmoji}
        </span>
        {h.partnerName && (
          <span className="text-ink-600">
            · בזוג עם <b>{h.partnerName}</b>
            {!h.partnerConfirmed && " (עוד לא אושר)"}
          </span>
        )}
        {h.submittedAt ? <Badge variant="mint">הגישה ✓ {DMY.format(new Date(h.submittedAt))}</Badge> : <Badge variant="gray">לא הגישה</Badge>}
        {h.autoTotal !== null && (
          <span className="text-ink-600">
            · בדיקה אוטומטית <b className="text-ink-900">{h.autoTotal}</b>/100{h.autoCapped ? " (מוגבל)" : ""}
          </span>
        )}
      </div>
      {h.submittedAt && (
        <div className="flex items-center gap-2 flex-wrap">
          {h.productUrl && (
            <a href={h.productUrl} target="_blank" rel="noopener" className={link} data-testid="hackathon-product-link">
              המערכת ↗
            </a>
          )}
          {h.videoUrl && (
            <a href={h.videoUrl} target="_blank" rel="noopener" className={link} data-testid="hackathon-video-link">
              הסרטון {h.videoKind === "drive" ? "(דרייב)" : h.videoKind === "file" ? "(קובץ)" : ""} ↗
            </a>
          )}
          {h.repoUrl && (
            <a href={h.repoUrl} target="_blank" rel="noopener" className={link}>
              הריפו ↗
            </a>
          )}
          <Link href="/admin/hackathon" className="text-[12.5px] font-semibold text-ink-500 hover:text-brand-purple hover:underline">
            לכל ההגשות והשיפוט ←
          </Link>
        </div>
      )}
    </div>
  );
}
