import type { MemberFeedback } from "@/lib/hackathon-feedback-shared";

const DM = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "Asia/Jerusalem" });

/**
 * המשוב על הפרויקט (the owner, 5/11): what the automated review found, per
 * criterion, in the team's own page - no score, no band. The same card is
 * what the admin's preview shows, so what the owner sees is what they get.
 */
export function FeedbackCard({ feedback, isPair }: { feedback: MemberFeedback; isPair: boolean }) {
  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm" data-testid="feedback-card">
      <div className="font-mono text-[12.5px] text-brand-pink-deep">{"// המשוב"}</div>
      <h2 className="font-display text-[18px] font-black text-ink-1000">המשוב על הפרויקט {isPair ? "שלכן" : "שלך"}</h2>
      {!feedback.finalist && (
        // The owner (6.11): half the teams got a glowing review and still stayed out - the finals had three places per challenge.
        <p className="mt-2 rounded-[12px] border border-[#F8C8D6] bg-[#FFF1F5] px-3 py-2 text-[13.5px] leading-relaxed text-ink-900" data-testid="feedback-finals-note">
          <b>לגמר עלו שלושה צוותים בכל אתגר, לפי ציוני השופטות.</b> המשוב כאן הוא מהבדיקה האוטומטית בלבד. הרבה פרויקטים עבדו מצוין, וההפרשים היו קטנים.
        </p>
      )}
      <p className="text-[12.5px] text-ink-500 mt-0.5">
        כך ראתה את המערכת הבדיקה האוטומטית של צוות ההאקתון{feedback.ranAt ? ` ב-${DM.format(new Date(feedback.ranAt))}` : ""}, לפי הקריטריונים לעלייה לגמר. הציונים עצמם לא מוצגים.
      </p>
      {feedback.blocked && (
        <div className="mt-3 rounded-[12px] border border-[#F2BBC8] bg-[#FDE8E8] px-3 py-2 text-[13px] text-[#A8254B]" data-testid="feedback-blocked">
          <b>מה עצר את הבדיקה:</b> {feedback.blocked}
        </div>
      )}
      <dl className="mt-3 flex flex-col divide-y divide-ink-100">
        {feedback.criteria.map((c) => (
          <div key={c.key} className="py-3 first:pt-0 last:pb-0" data-testid="feedback-criterion" data-key={c.key}>
            <dt className="flex items-baseline gap-2 flex-wrap">
              <span className="font-display font-bold text-[14.5px] text-ink-1000">{c.label}</span>
              <span className="text-[12px] text-ink-500">{c.hint}</span>
            </dt>
            <dd className="mt-1 text-[13.5px] leading-relaxed text-ink-800 break-words">{c.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
