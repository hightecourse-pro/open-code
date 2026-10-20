import Link from "next/link";
import { Badge } from "@/components/ui";
import type { AdminSubmissionRow } from "@/lib/hackathon-submission";
import { formatBytes } from "@/lib/hackathon-shared";

const RICH = "text-[13px] leading-relaxed [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_a]:text-brand-purple [&_a]:underline [&_h3]:font-bold [&_h3]:mt-1";

const WHEN = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

/** הגשות התוצרים (16/10): one row per team - links, video, tools, who answered the personal questions. */
export function SubmissionsTable({ rows }: { rows: AdminSubmissionRow[] }) {
  const submitted = rows.filter((r) => r.submittedAt).length;
  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
      <h3 className="font-display text-base font-bold mb-1">
        הגשות התוצרים ({submitted} הוגשו · {rows.length - submitted} טיוטות)
      </h3>
      <p className="text-[12.5px] text-ink-500 mb-3">הגשה אחת לצוות; השאלות האישיות - לכל אחת בנפרד. קישור הורדה לסרטון תקף לשעה.</p>
      {rows.length === 0 ? (
        <p className="text-ink-500 text-sm">עדיין אין הגשות.</p>
      ) : (
        <div className="flex flex-col">
          {rows.map((r) => (
            <details key={r.teamKey} className="group py-2.5 border-b border-ink-100 last:border-b-0">
              <summary className="list-none cursor-pointer flex items-center gap-3 flex-wrap [&::-webkit-details-marker]:hidden">
                <span className="font-medium text-ink-900">
                  {r.members.map((m, i) => (
                    <span key={m.id}>
                      {i > 0 && " + "}
                      <Link href={`/admin/members/${m.id}`} target="_blank" rel="noopener" className="hover:text-brand-purple hover:underline">
                        {m.name}
                      </Link>
                      {m.reflected ? " ✓" : " ·"}
                    </span>
                  ))}
                </span>
                <Badge variant="tech">{r.challengeShort}</Badge>
                {r.submittedAt ? <Badge variant="mint">הוגש {WHEN.format(new Date(r.submittedAt))}</Badge> : <Badge variant="gray">טיוטה</Badge>}
                <span className="ms-auto flex items-center gap-2 text-[12.5px]">
                  {r.productUrl && (
                    <a href={r.productUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-purple hover:underline">
                      מוצר
                    </a>
                  )}
                  {r.repoUrl && (
                    <a href={r.repoUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-purple hover:underline">
                      גיט
                    </a>
                  )}
                  {r.videoDownloadUrl && (
                    <a href={r.videoDownloadUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-purple hover:underline">
                      סרטון{r.videoSize ? ` (${formatBytes(r.videoSize)})` : ""}
                    </a>
                  )}
                  {r.videoUrl && (
                    <a href={r.videoUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-purple hover:underline">
                      קישור לסרטון
                    </a>
                  )}
                  <span className="text-ink-400 group-open:rotate-90 transition-transform">›</span>
                </span>
              </summary>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-[13px] text-ink-800">
                <div className="md:col-span-3">
                  <div className="font-mono text-[11.5px] text-brand-pink-deep">{"// הארכיטקטורה"}</div>
                  <Rich html={r.architecture} />
                </div>
                <div className="md:col-span-3">
                  <div className="font-mono text-[11.5px] text-brand-pink-deep">{"// הפיצ׳ר המקורי"}</div>
                  {r.originalFeature ? <Rich html={r.originalFeature} /> : <span className="text-[12.5px] text-ink-500">עוד לא נכתב</span>}
                </div>
                {/* fields of the first form version (until 20/10), shown only when filled */}
                {r.challengesSolved && (
                  <div className="md:col-span-3">
                    <div className="font-mono text-[11.5px] text-brand-pink-deep">{"// בעיות משמעותיות ואיך נפתרו (טופס קודם)"}</div>
                    <Rich html={r.challengesSolved} />
                  </div>
                )}
                {r.aiDevTools && (
                  <div>
                    <div className="font-mono text-[11.5px] text-brand-pink-deep">{"// כלי AI לפיתוח (טופס קודם)"}</div>
                    <Rich html={r.aiDevTools} />
                  </div>
                )}
                {r.aiModels && (
                  <div>
                    <div className="font-mono text-[11.5px] text-brand-pink-deep">{"// מודלי האיג׳נט (טופס קודם)"}</div>
                    <Rich html={r.aiModels} />
                  </div>
                )}
                {r.members.map((m) => (
                  <div key={m.id} className="md:col-span-3 rounded-[12px] bg-tint-warm/40 px-3 py-2">
                    <div className="font-mono text-[11.5px] text-brand-pink-deep">{`// ${m.name} - השאלות האישיות`}</div>
                    {m.reflection ? (
                      <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 mt-1">
                        <div>
                          <dt className="font-semibold text-ink-900">מה תרם לך הפרויקט?</dt>
                          <dd><Rich html={m.reflection.contributed} /></dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-ink-900">מה למדת על עצמך?</dt>
                          <dd><Rich html={m.reflection.learned} /></dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-ink-900">ממה הכי נהנית?</dt>
                          <dd><Rich html={m.reflection.enjoyed} /></dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-ink-500">עדיין לא ענתה.</p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

/** Editor HTML - sanitized to the brand allowlist when it was saved. */
function Rich({ html }: { html: string | null }) {
  if (!html) return <p className="text-ink-500">-</p>;
  return <div className={RICH} dangerouslySetInnerHTML={{ __html: html }} />;
}
