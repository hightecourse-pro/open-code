"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Trash2 } from "lucide-react";
import { Badge, Button, Select, Textarea } from "@/components/ui";
import { KIND_LABEL, REQUEST_KINDS, type RequestKind, type ReviewRequest } from "@/lib/hackathon-review-shared";
import { createReviewRequest, removeReviewRequest } from "./actions";

export interface ReviewRequestRow extends ReviewRequest {
  team: string;
  challenge: string;
}
export interface RequestTeam {
  teamKey: string;
  team: string;
  challenge: string;
}

const fmt = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
const RESPONSE_LABEL: Record<string, string> = { login: "פרטי כניסה", product_url: "כתובת המערכת", video_url: "קישור לסרטון", repo_url: "קישור לריפו", note: "הערה" };

/**
 * בקשות השלמה מצוותים (the owner, 24/10): which teams were asked for what,
 * the mail that went out (readable here), and whether each one answered. The
 * owner sends - all pending at once, or one team - and can first mail herself
 * a sample of each wording.
 */
export function ReviewRequests({ rows, teams, myEmail }: { rows: ReviewRequestRow[]; teams: RequestTeam[]; myEmail: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openMail, setOpenMail] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [teamKey, setTeamKey] = useState(teams[0]?.teamKey ?? "");
  const [kind, setKind] = useState<RequestKind>("login");
  const [detail, setDetail] = useState("");
  const [now] = useState(() => Date.now()); // one clock for the whole table, read once

  const sent = rows.filter((r) => r.sentAt).length;
  const responded = rows.filter((r) => r.respondedAt).length;
  const unsent = rows.filter((r) => !r.sentAt).length;

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/hackathon/review-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await res.json().catch(() => ({}))) as { error?: string; sent?: number; requests?: number; failed?: number; ok?: boolean; subject?: string; results?: { teamKey: string; sent: string[]; errors: string[] }[] };
    if (!res.ok || j.error) throw new Error(j.error ?? "השליחה נכשלה");
    return j;
  }
  async function send(ids?: string[]) {
    setBusy(ids?.[0] ?? "all");
    setError(null);
    try {
      const j = await post(ids ? { action: "send", ids } : { action: "send" });
      const lines = (j.results ?? []).map((r) => `${rows.find((x) => x.teamKey === r.teamKey)?.team ?? r.teamKey.slice(0, 8)}: ${r.sent.length ? `נשלח ל-${r.sent.join(", ")}` : "לא נשלח"}${r.errors.length ? ` · ${r.errors.join(" | ")}` : ""}`);
      setLog([`נשלחו ${j.sent ?? 0} מיילים ל-${j.requests ?? 0} צוותים${j.failed ? ` · ${j.failed} לא נשלחו` : ""}`, ...lines]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "השליחה נכשלה");
    } finally {
      setBusy(null);
    }
  }
  async function samples() {
    if (!myEmail) return setError("לא נמצאה כתובת מייל לחשבון שלך.");
    setBusy("samples");
    setError(null);
    const out: string[] = [];
    try {
      for (const k of REQUEST_KINDS) {
        const j = await post({ action: "sample", kind: k, to: myEmail });
        out.push(`${KIND_LABEL[k]}: ${j.ok ? `נשלחה דוגמה ל-${myEmail}` : `לא נשלח (${j.error ?? ""})`}`);
      }
      setLog(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "השליחה נכשלה");
    } finally {
      setBusy(null);
    }
  }
  function create() {
    setError(null);
    start(async () => {
      const r = await createReviewRequest(teamKey, kind, detail);
      if (r.error) return setError(r.error);
      setDetail("");
      router.refresh();
    });
  }
  function remove(r: ReviewRequestRow) {
    if (!confirm(`למחוק את הבקשה של ${r.team}?`)) return;
    setError(null);
    start(async () => {
      const res = await removeReviewRequest(r.id);
      if (res.error) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4" data-testid="review-requests">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <h3 className="font-display text-base font-bold">
            בקשות השלמה מצוותים <span className="text-ink-400 font-normal text-[13px]">({rows.length} · נשלחו {sent} · עודכנו {responded})</span>
          </h3>
          <p className="text-[12.5px] text-ink-500 mt-0.5">
            צוות שלא הצלחנו לבדוק (כניסה, מערכת למטה, סרטון לא נגיש, ריפו פרטי) מקבל מייל אישי עם מה שחסר, ומעדכנת בעמוד ההגשה שלה. כאן רואים מה נשלח, את המייל עצמו, ומי עדכנה.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" size="sm" variant="secondary" disabled={!!busy || !myEmail} onClick={samples} data-testid="rr-samples">
            {busy === "samples" ? "שולחת…" : "שלחי לי דוגמה מכל ניסוח"}
          </Button>
          <Button type="button" size="sm" disabled={!!busy || unsent === 0} onClick={() => send()} data-testid="rr-send-all">
            {busy === "all" ? "שולחת…" : `שליחת הבקשות שטרם נשלחו (${unsent})`}
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-500">אין בקשות עדיין.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[13px] min-w-[860px]">
            <thead>
              <tr className="text-start text-[12px] text-ink-500 border-b border-ink-200">
                <th className="py-2 px-1.5 text-start font-semibold">צוות</th>
                <th className="py-2 px-1.5 text-start font-semibold">מה חסר</th>
                <th className="py-2 px-1.5 text-start font-semibold">המייל</th>
                <th className="py-2 px-1.5 text-start font-semibold">עדכון מהצוות</th>
                <th className="py-2 px-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const overdue = !r.respondedAt && new Date(r.dueAt).getTime() < now;
                const status = r.respondedAt ? "responded" : overdue ? "overdue" : r.sentAt ? "sent" : "unsent";
                return (
                  <tr key={r.id} className="border-b border-ink-100 align-top" data-testid="rr-row" data-team={r.teamKey} data-status={status}>
                    <td className="py-2.5 px-1.5">
                      <div className="font-semibold text-ink-900">{r.team}</div>
                      <div className="text-[12px] text-ink-500">
                        {r.challenge} · עד {fmt.format(new Date(r.dueAt))}
                      </div>
                    </td>
                    <td className="py-2.5 px-1.5 max-w-[320px]">
                      <ul className="flex flex-col gap-1">
                        {r.items.map((it) => (
                          <li key={it.kind} className="flex items-start gap-1.5">
                            <Badge variant="purple" className="shrink-0">
                              {KIND_LABEL[it.kind]}
                            </Badge>
                            <span className="text-[12.5px] text-ink-700 leading-snug">{it.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-2.5 px-1.5 max-w-[260px]">
                      {r.sentAt ? (
                        <div className="text-[12.5px] text-ink-700">
                          <span className="text-success font-semibold">נשלח</span> {fmt.format(new Date(r.sentAt))}
                          <div className="text-ink-500 break-all" dir="ltr">
                            {r.sentTo.join(", ")}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[12.5px] text-ink-500">לא נשלח</span>
                      )}
                      {r.sendError && <div className="text-[12px] text-[#B42318] mt-0.5">{r.sendError}</div>}
                      {r.emailHtml && (
                        <button type="button" className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-purple hover:underline" onClick={() => setOpenMail(openMail === r.id ? null : r.id)} data-testid="rr-mail">
                          <Mail size={12} /> {openMail === r.id ? "סגירת המייל" : "לצפייה במייל"}
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-1.5 max-w-[300px]">
                      {r.respondedAt ? (
                        <div className="text-[12.5px]">
                          <Badge variant="mint">עודכנה ✓</Badge> <span className="text-ink-500">{fmt.format(new Date(r.respondedAt))}</span>
                          <dl className="mt-1 flex flex-col gap-0.5">
                            {Object.entries(r.response ?? {}).map(([k, v]) =>
                              v ? (
                                <div key={k} className="flex gap-1.5">
                                  <dt className="text-ink-500 shrink-0">{RESPONSE_LABEL[k] ?? k}:</dt>
                                  <dd className="text-ink-900 break-all whitespace-pre-wrap" dir={k.endsWith("_url") ? "ltr" : undefined}>
                                    {String(v)}
                                  </dd>
                                </div>
                              ) : null
                            )}
                          </dl>
                        </div>
                      ) : overdue ? (
                        <Badge variant="pink">עבר המועד</Badge>
                      ) : (
                        <span className="text-[12.5px] text-ink-500">ממתינה</span>
                      )}
                    </td>
                    <td className="py-2.5 px-1.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Button type="button" size="sm" variant="secondary" disabled={!!busy || pending} onClick={() => send([r.id])} data-testid="rr-send">
                          {busy === r.id ? "שולחת…" : r.sentAt ? "שליחה חוזרת" : "שליחה"}
                        </Button>
                        <button type="button" className="p-1.5 rounded-md text-ink-400 hover:text-[#B42318] hover:bg-ink-50" title="מחיקת הבקשה" disabled={!!busy || pending} onClick={() => remove(r)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openMail && (
        <div className="rounded-[14px] border border-ink-200 bg-ink-50 p-3" data-testid="rr-mail-view">
          <div className="text-[12.5px] text-ink-700 mb-2">
            <b>נושא:</b> {rows.find((r) => r.id === openMail)?.emailSubject}
          </div>
          <div className="bg-white rounded-md max-h-[420px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: rows.find((r) => r.id === openMail)?.emailHtml ?? "" }} />
        </div>
      )}

      {/* a new request by hand: the team, what is missing, in her words */}
      <div className="rounded-[14px] border border-dashed border-ink-200 p-3 flex flex-col gap-2" data-testid="rr-new-form">
        <div className="text-[12.5px] font-semibold text-ink-800">בקשה חדשה (המועד: מחר 23:59)</div>
        <div className="flex gap-2 flex-wrap">
          <Select value={teamKey} onChange={(e) => setTeamKey(e.target.value)} className="min-w-[220px]" aria-label="צוות">
            {teams.map((t) => (
              <option key={t.teamKey} value={t.teamKey}>
                {t.team} · {t.challenge}
              </option>
            ))}
          </Select>
          <Select value={kind} onChange={(e) => setKind(e.target.value as RequestKind)} className="min-w-[170px]" aria-label="מה חסר">
            {REQUEST_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </div>
        <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} placeholder="מה בדיוק חסר, במילים שהצוות תקרא - למשל: המערכת מבקשת שם משתמש וסיסמה ולא צורפו פרטי משתמש להדגמה." />
        <div>
          <Button type="button" size="sm" variant="secondary" disabled={pending || !teamKey || !detail.trim()} onClick={create}>
            הוספת הבקשה
          </Button>
        </div>
      </div>

      {log.length > 0 && (
        <ul className="text-[12px] text-ink-700 bg-ink-50 rounded-md px-3 py-2 flex flex-col gap-0.5 max-h-48 overflow-y-auto" data-testid="rr-log">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      {error && <p className="text-[12.5px] font-semibold text-[#B42318]">{error}</p>}
    </section>
  );
}
