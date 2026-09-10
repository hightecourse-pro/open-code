import type { ReactNode } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar, Badge, Button } from "@/components/ui";
import { langLevelLabel, parseLangSkills } from "@/lib/language-skills";
import { MessageBody } from "@/components/patterns/rich-text";
import { approveMentorApplication, rejectMentorApplication, sendPersonalEmail } from "../actions";

/**
 * The mentor-approval queue with the WHOLE application in front of her — the
 * owner (10/9): "אני לא רואה מול העיניים את כל הנתונים כדי לאשר". One shared
 * card for the dashboard AND /admin/mentors, so approving anywhere goes
 * through approveMentorApplication (the מייל אושרת flow) — the dashboard's
 * old ✓ went through the generic status action and sent her nothing.
 */
export async function PendingMentorApplications({
  heading,
  sub,
  footer,
  showEmpty = false,
}: {
  heading: string;
  sub: string;
  /** Rendered at the card's bottom (a "לכל…" link, say). */
  footer?: ReactNode;
  /** Render the card with a friendly empty line instead of disappearing. */
  showEmpty?: boolean;
}) {
  const supabase = await createClient();
  // Self-served applications from the join screen — approving is what mails
  // her the promised "אושרת" email.
  const { data: pendingApps } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_initials, specialization, profile_completed, created_at")
    .eq("role", "mentor")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  const pending = pendingApps ?? [];
  if (pending.length === 0 && !showEmpty) return null;

  const admin = createAdminClient();
  const pendingIds = pending.map((p) => p.id);

  // One CV per applicant (default first), resolved to short-lived signed links.
  const cvUrlOf = new Map<string, string>();
  if (pendingIds.length) {
    const { data: cvDocs } = await admin
      .from("cv_documents")
      .select("profile_id, file_path, is_default, created_at")
      .in("profile_id", pendingIds)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    const cvPathOf = new Map<string, string>();
    for (const d of cvDocs ?? []) {
      if (!cvPathOf.has(d.profile_id)) cvPathOf.set(d.profile_id, d.file_path);
    }
    const cvPaths = [...new Set(cvPathOf.values())];
    if (cvPaths.length) {
      const { data: cvSigned } = await admin.storage.from("cvs").createSignedUrls(cvPaths, 3600);
      const urlOfPath = new Map((cvSigned ?? []).map((s) => [s.path, s.signedUrl]));
      for (const [pid, path] of cvPathOf) {
        const url = urlOfPath.get(path);
        if (url) cvUrlOf.set(pid, url);
      }
    }
  }

  // Everything she needs IN FRONT OF HER to approve — the applicant's
  // questionnaire answers laid out on the card itself, not a click away.
  type Fact = { label: string; value: string };
  const factsOf = new Map<string, Fact[]>();
  const bioOf = new Map<string, string>();
  const notesOf = new Map<string, string>();
  if (pendingIds.length) {
    const [{ data: pendingQs }, { data: pendingAns }] = await Promise.all([
      admin
        .from("config_questions")
        .select("id, key, label_he, field_type, options, sort_order")
        .in("scope", ["all", "mentor"])
        .eq("active", true)
        .order("sort_order"),
      admin
        .from("profile_answers")
        .select("profile_id, question_id, value")
        .in("profile_id", pendingIds),
    ]);
    const emailOf = new Map<string, string>();
    for (const pid of pendingIds) {
      const { data: au } = await admin.auth.admin.getUserById(pid);
      if (au?.user?.email) emailOf.set(pid, au.user.email);
    }
    const qById = new Map((pendingQs ?? []).map((q) => [q.id, q]));
    const qByKey = new Map((pendingQs ?? []).map((q) => [q.key, q]));
    const valueOf = new Map<string, Map<string, unknown>>(); // pid -> key -> value
    for (const a of pendingAns ?? []) {
      const q = qById.get(a.question_id);
      if (!q) continue;
      if (!valueOf.has(a.profile_id)) valueOf.set(a.profile_id, new Map());
      valueOf.get(a.profile_id)!.set(q.key, a.value);
    }
    // Reading order: the mentor questions carry the decision — they lead.
    const FACT_KEYS = [
      "mentor_workplace", "mentor_years", "mentor_tech", "mentor_ai_experience",
      "mentor_contribution", "city", "phone", "language_skills", "github",
    ];
    const fmt = (key: string, v: unknown): string | null => {
      if (v == null) return null;
      if (key === "language_skills") {
        const s = parseLangSkills(v).map((x) => `${x.lang}: ${langLevelLabel(x.level)}`).join(" · ");
        return s || null;
      }
      const q = qByKey.get(key);
      const labelOf = new Map(
        (Array.isArray(q?.options) ? (q!.options as unknown as { value: string; label: string }[]) : []).map(
          (o) => [o.value, o.label]
        )
      );
      if (Array.isArray(v)) {
        if (v.length === 0) return null;
        if (typeof v[0] === "object" && v[0] !== null)
          return (v as { url?: string }[]).map((x) => x.url).filter(Boolean).join(" · ") || null;
        return (v as unknown[]).map((x) => labelOf.get(String(x)) ?? String(x)).join(" · ");
      }
      const s = String(v).trim();
      if (!s) return null;
      return labelOf.get(s) ?? s;
    };
    for (const pid of pendingIds) {
      const mine = valueOf.get(pid) ?? new Map<string, unknown>();
      const facts: Fact[] = [];
      for (const key of FACT_KEYS) {
        const q = qByKey.get(key);
        if (!q) continue;
        const val = fmt(key, mine.get(key));
        if (val) facts.push({ label: q.label_he, value: val });
      }
      const email = emailOf.get(pid);
      if (email) facts.push({ label: "מייל", value: email });
      factsOf.set(pid, facts);
      const bio = mine.get("bio");
      if (typeof bio === "string" && bio.trim()) bioOf.set(pid, bio);
      const notes = mine.get("notes_for_us");
      if (typeof notes === "string" && notes.trim()) notesOf.set(pid, notes);
    }
  }

  return (
    <div className="bg-white border border-[#EAD9A8] rounded-[18px] p-5 shadow-sm">
      <h3 className="font-display text-base font-bold mb-1">
        {heading}
        {pending.length > 0 && <> ({pending.length})</>}
      </h3>
      <p className="text-[12.5px] text-ink-500 mb-3">{sub}</p>
      {pending.length === 0 ? (
        <p className="text-sm text-ink-500 py-4 text-center">אין כרגע מנטוריות שממתינות לאישור 🎉</p>
      ) : (
        <div className="flex flex-col">
          {pending.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap">
              <Avatar size="sm" tone="gold" initials={p.avatar_initials || p.full_name.slice(0, 1)} />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/admin/members/${p.id}`}
                  className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                >
                  {p.full_name}
                </Link>
                <div className="text-[11.5px] text-ink-500">
                  {p.profile_completed ? "השאלון מולא ✓" : "עוד ממלאת את השאלון"}
                </div>
              </div>
              {p.specialization && <Badge variant="purple">{p.specialization}</Badge>}
              {cvUrlOf.has(p.id) ? (
                <a
                  href={cvUrlOf.get(p.id)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-purple hover:underline"
                >
                  <FileText size={13} /> קו&quot;ח
                </a>
              ) : (
                <span className="text-[11.5px] text-ink-400">עוד לא העלתה קו&quot;ח</span>
              )}
              <form action={approveMentorApplication.bind(null, p.id)}>
                <Button type="submit" size="sm">אישור 👑</Button>
              </form>

              {/* The whole application at a glance — approving straight off
                  the card, without opening the file (the owner, 10/9). */}
              {(factsOf.get(p.id) ?? []).length > 0 && (
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 bg-tint-warm/40 border border-[#EAD9A8] rounded-md p-3">
                  {factsOf.get(p.id)!.map((f) => (
                    <div key={f.label} className="min-w-0">
                      <div className="text-[11px] text-ink-500">{f.label}</div>
                      <div className="text-[12.5px] font-medium text-ink-900 break-words">{f.value}</div>
                    </div>
                  ))}
                </div>
              )}
              {bioOf.has(p.id) && (
                <div className="w-full text-[12.5px] text-ink-800">
                  <span className="text-[11px] text-ink-500 block">קצת עליה</span>
                  <MessageBody body={bioOf.get(p.id)!} />
                </div>
              )}
              {notesOf.has(p.id) && (
                <div className="w-full text-[12.5px] text-ink-800">
                  <span className="text-[11px] text-ink-500 block">עוד משהו שכתבה לנו</span>
                  <MessageBody body={notesOf.get(p.id)!} />
                </div>
              )}

              {/* A personal word before (or instead of) the decision — the
                  branded email that ALSO lands in her chat with the team. */}
              <details className="w-full">
                <summary className="cursor-pointer text-[12.5px] font-semibold text-brand-purple hover:underline list-none">
                  ✉️ מייל אישי (מופיע גם בצ&apos;אט שלה)
                </summary>
                <form
                  action={sendPersonalEmail.bind(null, p.id)}
                  className="mt-2 flex flex-col gap-2 bg-ink-50 border border-ink-200 rounded-md p-3"
                >
                  <textarea
                    name="note"
                    required
                    rows={3}
                    maxLength={4000}
                    className="w-full rounded-md border border-ink-200 bg-white p-2 text-[13px] focus:outline-none focus:border-brand-purple"
                    placeholder="ההודעה נשלחת אליה במייל ממותג ומופיעה גם בצ'אט שלה עם הצוות — התשובה שלה תגיע אלייך לצ'אט."
                  />
                  <div>
                    <Button type="submit" size="sm">שליחה</Button>
                  </div>
                </form>
              </details>

              {/* Declining requires a personal explanation — it goes to her
                  by email, and she stays a regular (not-subscribed) member. */}
              <details className="w-full">
                <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-500 hover:text-danger list-none">
                  דחייה…
                </summary>
                <form
                  action={rejectMentorApplication.bind(null, p.id)}
                  className="mt-2 flex flex-col gap-2 bg-ink-50 border border-ink-200 rounded-md p-3"
                >
                  <label className="text-[12px] font-semibold text-ink-700" htmlFor={`reject-${p.id}`}>
                    הודעה אישית שמסבירה את ההחלטה (נשלחת אליה במייל)
                  </label>
                  <textarea
                    id={`reject-${p.id}`}
                    name="note"
                    required
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-md border border-ink-200 bg-white p-2 text-[13px] focus:outline-none focus:border-brand-purple"
                    placeholder="למשל: ראינו שהניסיון שלך עדיין בתחילת הדרך — נשמח שתגישי שוב בעוד שנה…"
                  />
                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm" variant="ghost">שליחת הדחייה</Button>
                    <span className="text-[11.5px] text-ink-500">
                      היא נשארת משתתפת רגילה (לא מנויה) ותתבקש למלא את שאלון החברות.
                    </span>
                  </div>
                </form>
              </details>
            </div>
          ))}
        </div>
      )}
      {footer}
    </div>
  );
}
