import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmActionButton } from "@/components/patterns/confirm-action-button";
import { restoreEmails, restoreMember } from "./actions";

export const metadata: Metadata = { title: "הסרות ועזיבות" };
export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

/**
 * Who asked to stop hearing from us, and who left the community - each with
 * her reason (the owner, 18/10). Two lists, two ways back.
 */
export default async function DeparturesPage() {
  await requireRole("admin");
  const admin = createAdminClient();
  const [{ data: optOuts }, { data: leavers }] = await Promise.all([
    admin.from("email_opt_outs").select("email, kind, reason, profile_id, created_at").order("created_at", { ascending: false }).limit(1000),
    admin.from("profiles").select("id, full_name, left_at, left_reason, left_from_status, role").eq("status", "left").order("left_at", { ascending: false }).limit(1000),
  ]);
  const ids = [...new Set([...(optOuts ?? []).map((o) => o.profile_id).filter((x): x is string => !!x), ...(leavers ?? []).map((l) => l.id)])];
  const [{ data: names }, { data: emails }, { data: subs }] = await Promise.all([
    ids.length ? admin.from("profiles").select("id, full_name").in("id", ids) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    ids.length ? admin.rpc("member_emails", { p_ids: ids }) : Promise.resolve({ data: [] as { id: string; email: string | null }[] }),
    ids.length ? admin.from("subscriptions").select("profile_id, status, current_period_end").in("profile_id", ids) : Promise.resolve({ data: [] as { profile_id: string; status: string; current_period_end: string | null }[] }),
  ]);
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.full_name]));
  const emailOf = new Map(((emails ?? []) as { id: string; email: string | null }[]).map((e) => [e.id, e.email]));
  const subOf = new Map((subs ?? []).map((s) => [s.profile_id, s]));
  const stopped = (optOuts ?? []).filter((o) => o.kind === "emails");
  const STATUS: Record<string, string> = { active: "מנויה", pending: "ללא מנוי", paused: "מושהית" };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;הסרות ועזיבות/&gt;</span>
        <h1 className="font-display text-[26px] font-black text-ink-1000 mt-1">הסרות ועזיבות</h1>
        <p className="text-[13.5px] text-ink-600">מי ביקשה להפסיק לקבל מיילים (ונשארת), ומי יצאה מהקהילה - עם הסיבה שכתבה. כל מייל שאנחנו שולחות נושא קישור ״הסרה״ שמוביל לכאן.</p>
      </div>

      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h2 className="font-display text-[17px] font-bold mb-3">ביקשו לא לקבל מיילים ({stopped.length})</h2>
        {stopped.length === 0 ? (
          <p className="text-[13px] text-ink-500">אף אחת עדיין 💜</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-ink-500 text-right">
                <th className="py-1.5 pe-3 font-semibold">מי</th>
                <th className="py-1.5 pe-3 font-semibold">מייל</th>
                <th className="py-1.5 pe-3 font-semibold">מתי</th>
                <th className="py-1.5 pe-3 font-semibold">הסיבה</th>
                <th className="py-1.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {stopped.map((o) => (
                <tr key={o.email} className="border-t border-ink-100 align-top" data-optout={o.email}>
                  <td className="py-2 pe-3">
                    {o.profile_id ? (
                      <a href={`/admin/members/${o.profile_id}`} target="_blank" rel="noopener" className="font-semibold text-ink-900 hover:text-brand-purple hover:underline">
                        {nameOf.get(o.profile_id) ?? "חברה"}
                      </a>
                    ) : (
                      <span className="text-ink-500">לא חברה (רכזת / מעסיקה / אחר)</span>
                    )}
                  </td>
                  <td className="py-2 pe-3" dir="ltr">{o.email}</td>
                  <td className="py-2 pe-3 whitespace-nowrap" dir="ltr">{WHEN.format(new Date(o.created_at))}</td>
                  <td className="py-2 pe-3 text-ink-700 max-w-[360px]">{o.reason || <span className="text-ink-400">-</span>}</td>
                  <td className="py-2 text-left">
                    <ConfirmActionButton action={restoreEmails.bind(null, o.email)} message="להחזיר לה את המיילים? (רק אם ביקשה)" className="text-[12.5px] font-bold text-brand-purple hover:underline">
                      להחזיר מיילים
                    </ConfirmActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h2 className="font-display text-[17px] font-bold mb-1">יצאו מהקהילה ({(leavers ?? []).length})</h2>
        <p className="text-[12.5px] text-ink-500 mb-3">החשבון נשאר אצלנו (סגור). מנוי פעיל מבוטל ידנית בנדרים פלוס - מופיע כאן כדי שלא יישכח.</p>
        {(leavers ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-500">אף אחת עדיין 💜</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-ink-500 text-right">
                <th className="py-1.5 pe-3 font-semibold">מי</th>
                <th className="py-1.5 pe-3 font-semibold">מייל</th>
                <th className="py-1.5 pe-3 font-semibold">מתי</th>
                <th className="py-1.5 pe-3 font-semibold">הייתה</th>
                <th className="py-1.5 pe-3 font-semibold">מנוי</th>
                <th className="py-1.5 pe-3 font-semibold">הסיבה</th>
                <th className="py-1.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {(leavers ?? []).map((l) => {
                const s = subOf.get(l.id);
                const live = s && (s.status === "active" || s.status === "trialing" || s.status === "past_due");
                return (
                  <tr key={l.id} className="border-t border-ink-100 align-top" data-leaver={l.id}>
                    <td className="py-2 pe-3">
                      <a href={`/admin/members/${l.id}`} target="_blank" rel="noopener" className="font-semibold text-ink-900 hover:text-brand-purple hover:underline">
                        {l.full_name}
                      </a>
                      {l.role === "mentor" && <span className="ms-1">👑</span>}
                    </td>
                    <td className="py-2 pe-3" dir="ltr">{emailOf.get(l.id) ?? "-"}</td>
                    <td className="py-2 pe-3 whitespace-nowrap" dir="ltr">{l.left_at ? WHEN.format(new Date(l.left_at)) : "-"}</td>
                    <td className="py-2 pe-3">{STATUS[l.left_from_status ?? ""] ?? l.left_from_status ?? "-"}</td>
                    <td className="py-2 pe-3">
                      {live ? (
                        <span className="rounded-full bg-[#FDE8E8] text-[#B42318] px-2 py-0.5 text-[11.5px] font-bold">פעיל - לבטל בנדרים{s?.current_period_end ? ` (עד ${new Date(s.current_period_end).toLocaleDateString("he-IL")})` : ""}</span>
                      ) : (
                        <span className="text-ink-500">{s ? "לא פעיל" : "אין"}</span>
                      )}
                    </td>
                    <td className="py-2 pe-3 text-ink-700 max-w-[320px]">{l.left_reason || <span className="text-ink-400">-</span>}</td>
                    <td className="py-2 text-left">
                      <ConfirmActionButton action={restoreMember.bind(null, l.id)} message="להחזיר אותה לקהילה? החשבון ייפתח במצב שהיה לפני היציאה." className="text-[12.5px] font-bold text-brand-purple hover:underline">
                        להחזיר לקהילה
                      </ConfirmActionButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
