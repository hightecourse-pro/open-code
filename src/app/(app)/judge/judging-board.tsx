import Link from "next/link";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { JudgingEntry } from "@/lib/judging";
import { CRITERIA, type AutoCheck } from "@/lib/judging-shared";
import { formatBytes } from "@/lib/hackathon-shared";
import { CHALLENGES } from "@/app/hackathon-2026/shared";
import { ScoreForm } from "./score-form";
import { LazyVideo } from "@/components/patterns/lazy-video";

const WHEN = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
const RICH = "text-[13px] leading-relaxed [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_a]:text-brand-purple [&_a]:underline [&_h3]:font-bold [&_h3]:mt-1";
// A report is data written by the review tooling - a status the map does not know renders as "skip" rather than
// crashing the admin page (24/10: "unknown" took /admin/hackathon down for the owner).
const STATUS: Record<AutoCheck["status"], { icon: string; cls: string }> = {
  pass: { icon: "✓", cls: "bg-tint-mint text-success" },
  fail: { icon: "✕", cls: "bg-[#FDE8E8] text-[#B42318]" },
  warn: { icon: "!", cls: "bg-tint-warm text-[#8C5E0E]" },
  skip: { icon: "–", cls: "bg-ink-100 text-ink-500" },
};

/**
 * The judging board - the same component for the team (every judge's scores,
 * average, gap, rank) and for an appointed mentor (her own score only).
 */
export function JudgingBoard({ entries, viewerId, manage }: { entries: JudgingEntry[]; viewerId: string; manage: boolean }) {
  const byChallenge = new Map<string, JudgingEntry[]>();
  for (const e of entries) byChallenge.set(e.submission.challengeKey, [...(byChallenge.get(e.submission.challengeKey) ?? []), e]);
  if (entries.length === 0) {
    return <p className="bg-white border border-ink-200 rounded-[18px] p-5 text-ink-500 text-sm shadow-sm">עדיין אין הגשות שהוגשו. הלוח יתמלא ברגע שצוות ראשון ילחץ ״הגשה סופית״.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      {[...byChallenge.entries()].map(([key, group]) => {
        const c = CHALLENGES.find((x) => x.key === key);
        return (
          <section key={key} className="flex flex-col gap-3">
            <h2 className="font-display text-[19px] font-black text-ink-1000 flex items-center gap-2">
              <span>{c?.emoji}</span> אתגר {c?.short ?? key}
              <span className="text-[13px] font-semibold text-ink-500">· {group.length} הגשות</span>
            </h2>
            {group.map((e) => (
              <JudgingEntryCard key={e.submission.teamKey} e={e} viewerId={viewerId} manage={manage} lazyVideo />
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** One project: header + links, the video in the page, the automated report (owner only), what the team wrote, the score form. */
export function JudgingEntryCard({ e, viewerId, manage, lazyVideo = false }: { e: JudgingEntry; viewerId: string; manage: boolean; lazyVideo?: boolean }) {
  const s = e.submission;
  const report = e.report;
  const checks = report?.checks ?? [];
  const passed = checks.filter((c) => c.status === "pass").length;
  return (
    <article className="bg-white border border-ink-200 rounded-[18px] shadow-sm overflow-hidden">
      {/* header */}
      <div className="px-5 py-3.5 flex items-center gap-3 flex-wrap border-b border-ink-100">
        <div className="font-display font-black text-[16px] text-ink-1000">{s.members.map((m) => m.name).join(" + ")}</div>
        {e.mine ? <Badge variant="mint">הציון שלך: {e.mine.total}</Badge> : <Badge variant="pink">עוד לא שפטת</Badge>}
        {manage && e.average !== null && (
          <Badge variant="purple">
            ממוצע {e.average} · {e.scores.length} שופטות{e.rank ? ` · מקום ${e.rank}` : ""}
          </Badge>
        )}
        {manage && e.gap && <Badge variant="warm">פער גדול בין השופטות - צריך שלישית</Badge>}
        <span className="ms-auto flex items-center gap-2.5 text-[12.5px] font-semibold">
          {s.productUrl && (
            <a href={s.productUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-brand-gradient text-white px-3 py-1">
              המוצר החי ↗
            </a>
          )}
          {s.repoUrl && (
            <a href={s.repoUrl} target="_blank" rel="noopener noreferrer" className="text-brand-purple hover:underline">
              גיט
            </a>
          )}
          {s.videoDownloadUrl && (
            <a href={s.videoDownloadUrl} target="_blank" rel="noopener noreferrer" className="text-brand-purple hover:underline">
              סרטון{s.videoSize ? ` (${formatBytes(s.videoSize)})` : ""}
            </a>
          )}
          {s.videoUrl && (
            <a href={s.videoUrl} target="_blank" rel="noopener noreferrer" className="text-brand-purple hover:underline">
              קישור לסרטון
            </a>
          )}
        </span>
      </div>

      {/* the video, in the page (the owner, 23/10: "הדפדוף בין הסרטונים חייב להיות נח") */}
      {(s.videoEmbedUrl || s.videoInlineUrl) && (
        <div className="px-5 pt-4" data-testid="judge-video">
          <LazyVideo embedUrl={s.videoEmbedUrl} inlineUrl={s.videoInlineUrl} lazy={lazyVideo} />
        </div>
      )}

      <div className={cn("px-5 py-4 grid grid-cols-1 gap-5", manage && "lg:grid-cols-5")}>
        {/* the automated report - the owner's view only (23/10) */}
        {manage && (
        <div className="lg:col-span-2 flex flex-col gap-2">
          <div className="font-mono text-[12px] text-brand-pink-deep">{"// דשבורד הבדיקה האוטומטית"}</div>
          {report ? (
            <>
              <div className="text-[12px] text-ink-500">
                {passed}/{checks.length} בדיקות עברו{e.reportUpdatedAt ? ` · רץ ${WHEN.format(new Date(e.reportUpdatedAt))}` : ""}
              </div>
              <ul className="flex flex-col gap-1">
                {checks.map((c) => (
                  <li key={c.key} className="flex items-start gap-2 text-[13px]">
                    <span className={`shrink-0 mt-0.5 h-[18px] w-[18px] rounded-full inline-flex items-center justify-center text-[11px] font-black ${(STATUS[c.status] ?? STATUS.skip).cls}`}>{(STATUS[c.status] ?? STATUS.skip).icon}</span>
                    <span>
                      <b className="text-ink-900">{c.label}</b>
                      {c.detail && <span className="text-ink-600"> · {c.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {report.summary && <p className="text-[13px] text-ink-800 leading-relaxed bg-tint-purple/30 rounded-[12px] px-3 py-2 whitespace-pre-wrap">{report.summary}</p>}
              {/* the reviewer's screenshot of the live product (a small data URI - the owner's eyes on what ran) */}
              {report.screenshots?.[0]?.startsWith("data:image/") && (
                // eslint-disable-next-line @next/next/no-img-element -- an inline data URI from the automated report
                <img src={report.screenshots[0]} alt="צילום מסך מהבדיקה האוטומטית" className="w-full max-w-[420px] rounded-[10px] border border-ink-200" data-testid="auto-report-shot" />
              )}
              {report.suggested && (
                <div className="text-[12px] text-ink-600">
                  ציון מוצע מהבדיקה:{" "}
                  {CRITERIA.filter((c) => report.suggested?.[c.key] !== undefined)
                    .map((c) => `${c.label} ${report.suggested?.[c.key]}/${c.max}`)
                    .join(" · ")}
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] text-ink-500">הבדיקה האוטומטית עוד לא רצה על ההגשה הזו.</p>
          )}
        </div>
        )}

        {/* what they wrote */}
        <div className={cn("flex flex-col gap-3", manage && "lg:col-span-3")}>
          <details className="group">
            <summary className="list-none cursor-pointer font-mono text-[12px] text-brand-pink-deep [&::-webkit-details-marker]:hidden">{"// הארכיטקטורה, הפיצ׳ר המקורי, ומה שנכתב בגרסה הקודמת של הטופס"} <span className="text-ink-400 group-open:rotate-90 inline-block transition-transform">›</span></summary>
            <div className="mt-2 flex flex-col gap-3">
              <div>
                <div className="text-[12px] font-semibold text-ink-500">הארכיטקטורה</div>
                <Rich html={s.architecture} />
              </div>
              <div className="rounded-[12px] bg-tint-pink/30 border border-brand-pink/30 px-3 py-2">
                <div className="text-[12px] font-bold text-brand-pink-deep">הפיצ׳ר המקורי (קריטריון ״פיצ׳ר מקורי שלא חשבו עליו״, 15 נק׳)</div>
                {s.originalFeature ? <Rich html={s.originalFeature} /> : <span className="text-[12.5px] text-ink-500">הצוות עוד לא כתב.</span>}
              </div>
              {/* fields of the first version of the form (until 20/10) - shown only when a team filled them */}
              {s.challengesSolved && (
                <div>
                  <div className="text-[12px] font-semibold text-ink-500">בעיות משמעותיות ואיך נפתרו</div>
                  <Rich html={s.challengesSolved} />
                </div>
              )}
              {(s.aiDevTools || s.aiModels) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {s.aiDevTools && (
                    <div>
                      <div className="text-[12px] font-semibold text-ink-500">כלי AI לפיתוח</div>
                      <Rich html={s.aiDevTools} />
                    </div>
                  )}
                  {s.aiModels && (
                    <div>
                      <div className="text-[12px] font-semibold text-ink-500">מודלי האיג׳נט</div>
                      <Rich html={s.aiModels} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </details>

          {/* other judges (team only) */}
          {manage && e.scores.filter((x) => x.judgeId !== viewerId).length > 0 && (
            <div className="rounded-[12px] border border-ink-200 px-3 py-2 text-[12.5px]">
              <div className="font-semibold text-ink-700 mb-1">השופטות האחרות</div>
              {e.scores
                .filter((x) => x.judgeId !== viewerId)
                .map((x) => (
                  <div key={x.judgeId} className="flex items-center gap-2 flex-wrap">
                    <b>{x.judgeName}</b>: {x.total}
                    <span className="text-ink-500">({CRITERIA.map((c) => x.scores[c.key]).join(" / ")})</span>
                    {x.comment && <span className="text-ink-700 basis-full">״{x.comment}״</span>}
                  </div>
                ))}
            </div>
          )}

          <div>
            <div className="font-mono text-[12px] text-brand-pink-deep mb-1.5">{"// הציון שלך"}</div>
            <ScoreForm teamKey={s.teamKey} initial={e.mine?.scores ?? null} notes={e.mine?.notes ?? {}} comment={e.mine?.comment ?? null} savedAt={e.mine?.updatedAt ?? null} />
          </div>
          {manage && (
            <div className="text-[12px] text-ink-500">
              תיק החברות:{" "}
              {s.members.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && " · "}
                  <Link href={`/admin/members/${m.id}`} target="_blank" rel="noopener" className="text-brand-purple hover:underline">
                    {m.name}
                  </Link>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Rich({ html }: { html: string | null }) {
  if (!html) return <p className="text-[13px] text-ink-500">-</p>;
  return <div className={RICH} dangerouslySetInnerHTML={{ __html: html }} />;
}
