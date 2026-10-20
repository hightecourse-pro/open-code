import { Lock } from "lucide-react";
import type { Reflection, Submission, Team } from "@/lib/hackathon-submission";

/*
  The submission after the team closed it (the owner, 20/10: "ניתן לערוך את
  ההגשה כל עוד בניהול אני לא לוחצת על סגירה להגשות"): everything they wrote,
  read-only - no editors, no buttons. The server actions refuse writes as
  well, so this is a courtesy, not the lock.
*/
const RICH =
  "text-[13.5px] leading-relaxed text-ink-900 [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_a]:text-brand-purple [&_a]:underline [&_h3]:font-bold [&_h3]:mt-2 [&_p]:my-1";

const WHEN = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

function Rich({ html }: { html: string | null }) {
  if (!html) return <span className="text-[13px] text-ink-400">לא נכתב</span>;
  return <div className={RICH} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] font-semibold text-ink-800">{label}</span>
      {children}
    </div>
  );
}

function Url({ href }: { href: string | null }) {
  if (!href) return <span className="text-[13px] text-ink-400">לא נכתב</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-[13.5px] text-brand-purple underline break-all">
      {href}
    </a>
  );
}

export function LockedBanner({ closedAt }: { closedAt: string }) {
  return (
    <section
      className="flex items-start gap-3 rounded-[18px] border-2 border-ink-300 bg-ink-50 px-5 py-4 text-[14px] text-ink-900"
      style={{ borderRadius: "22px 16px 24px 18px" }}
      data-testid="submissions-locked"
    >
      <Lock size={20} className="text-ink-600 shrink-0 mt-0.5" />
      <div>
        <div className="font-display font-black text-[17px]">ההגשות נסגרו {WHEN.format(new Date(closedAt))}</div>
        <p className="mt-1 text-ink-700 leading-relaxed">
          ההגשה שלכן נשמרה בדיוק כמו שהייתה ברגע הסגירה, והשופטות עובדות עליה. אפשר לצפות בה כאן - לא לערוך. נתראה בערב הגמר.
        </p>
      </div>
    </section>
  );
}

export function LockedView({ team, submission, reflections, viewerId }: { team: Team; submission: Submission | null; reflections: Map<string, Reflection>; viewerId: string }) {
  const s = submission;
  const fileName = s?.videoPath ? s.videoPath.split("/").pop()?.replace(/^\d+-/, "") : null;
  return (
    <>
      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4" data-testid="locked-product">
        <div>
          <div className="font-mono text-[12.5px] text-brand-pink-deep">{"// המוצר"}</div>
          <h2 className="font-display text-[18px] font-black text-ink-1000">מה בניתן</h2>
        </div>
        <Field label="1. לינק למערכת בענן">
          <Url href={s?.productUrl ?? null} />
        </Field>
        <Field label="2. לינק לספריית גיט ציבורית">
          <Url href={s?.repoUrl ?? null} />
        </Field>
        <Field label="3. תיאור קצר של הארכיטקטורה">
          <Rich html={s?.architecture ?? null} />
        </Field>
        <div className="rounded-[14px] bg-tint-pink/30 border border-brand-pink/30 p-3.5">
          <Field label="5. הפיצ׳ר המקורי שלכן">
            <Rich html={s?.originalFeature ?? null} />
          </Field>
        </div>
        {s?.challengesSolved && (
          <Field label="בעיות משמעותיות ואיך פתרתן אותן (מהגרסה הקודמת של הטופס)">
            <Rich html={s.challengesSolved} />
          </Field>
        )}
      </section>

      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
        <div>
          <div className="font-mono text-[12.5px] text-brand-pink-deep">{"// הסרטון והכלים"}</div>
          <h2 className="font-display text-[18px] font-black text-ink-1000">איך בניתן</h2>
        </div>
        <Field label="4. הסרטון">
          {fileName ? (
            <span className="text-[13.5px] text-ink-900" dir="ltr">
              🎬 {fileName}
            </span>
          ) : (
            <Url href={s?.videoUrl ?? null} />
          )}
        </Field>
        {s?.aiDevTools && (
          <Field label="כלי ה-AI לפיתוח (מהגרסה הקודמת של הטופס)">
            <Rich html={s.aiDevTools} />
          </Field>
        )}
        {s?.aiModels && (
          <Field label="מודלי ה-AI של האיג׳נט (מהגרסה הקודמת של הטופס)">
            <Rich html={s.aiModels} />
          </Field>
        )}
      </section>

      {team.members.map((m) => {
        const r = reflections.get(m.id);
        const mine = m.id === viewerId;
        if (!mine && !r) return null;
        return (
          <section key={m.id} className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
            <div>
              <div className="font-mono text-[12.5px] text-brand-pink-deep">{mine ? "// את" : `// ${m.name}`}</div>
              <h2 className="font-display text-[18px] font-black text-ink-1000">{mine ? "6. השאלות על התהליך שלך" : `6. השאלות על התהליך של ${m.name}`}</h2>
            </div>
            <Field label="מה תרם לך הפרויקט?">
              <Rich html={r?.contributed ?? null} />
            </Field>
            <Field label="מה למדת על עצמך במהלך בניית הפרויקט?">
              <Rich html={r?.learned ?? null} />
            </Field>
            <Field label="ממה הכי נהנית?">
              <Rich html={r?.enjoyed ?? null} />
            </Field>
          </section>
        );
      })}
    </>
  );
}
