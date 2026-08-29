import type { Metadata } from "next";
import Link from "next/link";
import { FileText, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { Badge, Button, Select } from "@/components/ui";
import { mentorReasonLabel } from "@/lib/mentor-requests";
import { assignMentorToRequest, setMentorRequestStatus } from "../actions";
import { HandledRequestsList, type HandledRequestRow } from "./handled-list";

export const metadata: Metadata = { title: "בקשות לליווי" };
export const dynamic = "force-dynamic";

const FULL_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

/** "ממתינה 3 ימים" — the age of an open request, in words. */
function waitingHe(iso: string): string {
  const hours = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
  if (hours < 24) return hours <= 1 ? "ממתינה פחות משעה" : `ממתינה ${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ממתינה יום" : `ממתינה ${days} ימים`;
}

function KindBadge({ kind }: { kind: string }) {
  return kind === "employment" ? (
    <Badge variant="warm">ליווי תעסוקתי 💼</Badge>
  ) : (
    <Badge variant="purple">מנטורית</Badge>
  );
}

/**
 * The matching aid: search every active junior by name, technology and years
 * of experience — the answers a good mentor match hangs on. Reads answers with
 * the user (admin) client; RLS lets admins read everything anyway.
 */
async function searchJuniors(q: string, tech: string, minYears: number) {
  // Pushed into SQL (search_juniors RPC): the old version loaded EVERY active
  // junior and EVERY tech/years answer just to filter 30 rows in JS.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminClient().rpc("search_juniors", {
    p_q: q,
    p_tech: tech,
    p_min_years: minYears,
    p_limit: 30,
  });
  return (data ?? []).map((j) => ({
    id: j.id,
    full_name: j.full_name,
    avatar_initials: j.avatar_initials,
    specialization: j.specialization,
    years: j.years,
    tech: (j.tech ?? []).slice(0, 5),
  }));
}

export default async function AdminMentorRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ jq?: string; jtech?: string; jyears?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const jq = (sp.jq ?? "").trim();
  const jtech = (sp.jtech ?? "").trim();
  const jyears = Math.max(0, Number(sp.jyears) || 0);
  const searching = !!(jq || jtech || jyears);
  const supabase = await createClient();

  const [{ data: requests }, { data: mentors }] = await Promise.all([
    supabase
      .from("mentor_requests")
      .select(
        "id, profile_id, reason, note, status, kind, assigned_mentor_id, mentor_accepted_at, created_at, handled_at, reopen_reason, reopened_at"
      )
      .order("status", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, specialization, mentor_available")
      .eq("role", "mentor")
      .eq("status", "active")
      .order("full_name", { ascending: true }),
  ]);

  // Requesters + assigned mentors, resolved in one query.
  const ids = [
    ...new Set(
      (requests ?? []).flatMap((r) =>
        [r.profile_id, r.assigned_mentor_id].filter((x): x is string => !!x)
      )
    ),
  ];
  const { data: members } = ids.length
    ? await supabase.from("profiles").select("id, full_name, specialization").in("id", ids)
    : { data: [] };
  const memberOf = new Map((members ?? []).map((m) => [m.id, m]));

  const open = (requests ?? []).filter((r) => r.status === "open");
  const handled = (requests ?? []).filter((r) => r.status !== "open");

  // Each mentor's CURRENT load — accepted, still-handled accompaniments. The
  // dropdown says who is free and who already carries how many.
  const loadOf = new Map<string, number>();
  for (const r of handled) {
    if (r.assigned_mentor_id && r.mentor_accepted_at) {
      loadOf.set(r.assigned_mentor_id, (loadOf.get(r.assigned_mentor_id) ?? 0) + 1);
    }
  }

  // Open requesters: years of experience + a CV link — what a match hangs on.
  const openIds = open.map((r) => r.profile_id);
  const admin = createAdminClient();
  const { data: yearsQ } = await supabase
    .from("config_questions")
    .select("id")
    .eq("key", "years_experience")
    .maybeSingle();
  const { data: yearsAnswers } =
    openIds.length && yearsQ
      ? await supabase
          .from("profile_answers")
          .select("profile_id, value")
          .eq("question_id", yearsQ.id)
          .in("profile_id", openIds)
      : { data: [] };
  const yearsOf = new Map(
    (yearsAnswers ?? []).flatMap((a) =>
      typeof a.value === "number" ? [[a.profile_id, a.value] as const] : []
    )
  );
  const { data: openCvs } = openIds.length
    ? await admin
        .from("cv_documents")
        .select("profile_id, file_path, is_default, created_at")
        .in("profile_id", openIds)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })
    : { data: [] };
  const cvPathOf = new Map<string, string>();
  for (const d of openCvs ?? []) {
    if (!cvPathOf.has(d.profile_id)) cvPathOf.set(d.profile_id, d.file_path);
  }
  const cvPaths = [...new Set(cvPathOf.values())];
  const { data: cvSigned } = cvPaths.length
    ? await admin.storage.from("cvs").createSignedUrls(cvPaths, 3600)
    : { data: [] };
  const cvUrlOfPath = new Map((cvSigned ?? []).map((s) => [s.path, s.signedUrl]));
  const cvUrlOf = (pid: string) => {
    const p = cvPathOf.get(pid);
    return p ? (cvUrlOfPath.get(p) ?? null) : null;
  };

  /** Mentor options for one request: matching field first, least-loaded first. */
  const mentorOptionsFor = (requesterSpec: string | null) =>
    (mentors ?? [])
      .filter((m) => m.mentor_available !== false)
      .slice()
      .sort((a, b) => {
        const match = (x: { specialization: string | null }) =>
          requesterSpec && x.specialization === requesterSpec ? 0 : 1;
        const d = match(a) - match(b);
        if (d !== 0) return d;
        return (loadOf.get(a.id) ?? 0) - (loadOf.get(b.id) ?? 0);
      })
      .map((m) => {
        const load = loadOf.get(m.id) ?? 0;
        const fit = requesterSpec && m.specialization === requesterSpec ? "🎯 " : "";
        const loadLabel = load === 0 ? "פנויה" : load === 1 ? "ליווי פעיל אחד" : `${load} ליוויים פעילים`;
        return {
          id: m.id,
          label: `${fit}${m.full_name} · ${m.specialization ?? "ללא תחום"} · ${loadLabel}`,
        };
      });

  const [juniorResults, { data: techTax }] = await Promise.all([
    searching ? searchJuniors(jq, jtech, jyears) : Promise.resolve([]),
    supabase.from("config_taxonomies").select("value, label_he").eq("kind", "tech").order("label_he"),
  ]);
  const techLabel = new Map((techTax ?? []).map((t) => [t.value, t.label_he]));

  const handledRows: HandledRequestRow[] = handled.map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    memberName: memberOf.get(r.profile_id)?.full_name ?? "חברת קהילה",
    kind: r.kind,
    reasonLabel: mentorReasonLabel(r.reason),
    mentorName: r.assigned_mentor_id
      ? (memberOf.get(r.assigned_mentor_id)?.full_name ?? null)
      : null,
    accepted: !!r.mentor_accepted_at,
    createdAt: r.created_at,
    handledAt: r.handled_at,
    reopenReason: r.reopen_reason,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;בקשות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">בקשות לליווי</h1>
        <p className="t-body-sm text-ink-500">
          חברות שביקשו שנחבר אותן למנטורית. שיוך שולח למנטורית הזמנה — החברה רואה אותה רק
          אחרי שהמנטורית מאשרת.
        </p>
      </div>

      <div className="rounded-[18px] p-[2px] bg-brand-gradient">
        <div className="bg-white rounded-[16px] p-5">
          <h3 className="font-display text-base font-bold mb-3">ממתינות לטיפול ({open.length})</h3>
          {open.length > 0 ? (
            <div className="flex flex-col">
              {open.map((r) => {
                const m = memberOf.get(r.profile_id);
                const years = yearsOf.get(r.profile_id);
                const cvUrl = cvUrlOf(r.profile_id);
                const options = mentorOptionsFor(m?.specialization ?? null);
                return (
                  <div
                    key={r.id}
                    className="flex flex-col gap-1.5 py-3.5 border-b border-ink-100 last:border-b-0"
                  >
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Link
                        href={`/admin/members/${r.profile_id}`}
                        className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                      >
                        {m?.full_name ?? "חברת קהילה"}
                      </Link>
                      {m?.specialization && <Badge variant="tech">{m.specialization}</Badge>}
                      {years != null && (
                        <span className="text-[12px] text-ink-600 font-semibold">
                          {years} שנות ניסיון
                        </span>
                      )}
                      <KindBadge kind={r.kind} />
                      <Badge variant="indigo">{mentorReasonLabel(r.reason)}</Badge>
                      <span className="text-[11.5px] text-ink-500">
                        <span dir="ltr">{FULL_DATE.format(new Date(r.created_at))}</span>
                      </span>
                      <span className="text-[11.5px] font-semibold text-brand-pink-deep">
                        {waitingHe(r.created_at)}
                      </span>
                      <div className="ms-auto flex gap-1.5">
                        <form action={setMentorRequestStatus.bind(null, r.id, "handled")}>
                          <Button type="submit" size="sm" variant="ghost">
                            סימון כטופל
                          </Button>
                        </form>
                      </div>
                    </div>
                    {r.reopen_reason && (
                      <div className="text-[12px] font-semibold text-[#8C5E0E] bg-tint-warm/60 border border-[#F0DCA8] rounded-md px-3 py-1.5 w-fit">
                        ↩ הוחזרה לטיפול: {r.reopen_reason}
                        {r.reopened_at && (
                          <span className="text-ink-500 font-normal" dir="ltr">
                            {" "}
                            ({FULL_DATE.format(new Date(r.reopened_at))})
                          </span>
                        )}
                      </div>
                    )}
                    {r.note ? (
                      <div className="bg-ink-50 border border-ink-100 rounded-md px-3 py-2 text-[13px] text-ink-700 whitespace-pre-wrap">
                        <b className="text-ink-900">מה היא כתבה:</b> {r.note}
                      </div>
                    ) : (
                      <div className="text-[12px] text-ink-400">לא צירפה טקסט לבקשה.</div>
                    )}
                    <div className="flex items-center gap-3 flex-wrap text-[12.5px]">
                      <Link
                        href={`/admin/members/${r.profile_id}`}
                        className="font-semibold text-brand-purple hover:underline"
                      >
                        לפרופיל המלא ←
                      </Link>
                      {cvUrl && (
                        <a
                          href={cvUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-brand-purple hover:underline"
                        >
                          <FileText size={13} /> קורות החיים שלה
                        </a>
                      )}
                      <Link
                        href={`/chat?with=${r.profile_id}`}
                        className="inline-flex items-center gap-1 font-semibold text-brand-purple hover:underline"
                      >
                        <MessageCircle size={13} /> צ&apos;אט איתה
                      </Link>
                    </div>
                    {options.length > 0 ? (
                      <form
                        action={assignMentorToRequest.bind(null, r.id)}
                        className="flex items-center gap-2 flex-wrap"
                      >
                        <div className="w-[340px] max-w-full">
                          <Select name="mentor_id" required defaultValue="" className="!py-2 text-[13px]">
                            <option value="" disabled>
                              בחירת מנטורית… (🎯 = תחום תואם, ממוינות לפי עומס)
                            </option>
                            {options.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Button type="submit" size="sm">
                          שיוך מנטורית 👑
                        </Button>
                      </form>
                    ) : (
                      <span className="text-[12px] text-ink-500">
                        אין כרגע מנטוריות זמינות לשיוך.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-ink-500 text-sm py-2">אין בקשות פתוחות כרגע 💜</p>
          )}
        </div>
      </div>

      {/* The matching aid: find a junior ACROSS THE WHOLE COMMUNITY (not only
          those who asked) — for starting an accompaniment proactively. */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">איתור ג&#39;וניורית לליווי יזום</h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          חיפוש בין כל חברות הקהילה (לא רק מי שביקשה) — כשעולה רעיון לחבר מישהי למנטורית
          ביוזמתנו. החיפוש לא מסנן את הבקשות שלמעלה.
        </p>
        <form method="get" className="flex flex-wrap items-end gap-2 mb-3">
          <input
            name="jq"
            defaultValue={jq}
            placeholder="שם או תחום…"
            className="px-3 py-2 rounded-md border border-ink-300 text-sm outline-none focus:border-brand-purple w-44"
          />
          <select
            name="jtech"
            defaultValue={jtech}
            className="px-3 py-2 rounded-md border border-ink-300 text-sm outline-none focus:border-brand-purple bg-white"
          >
            <option value="">כל טכנולוגיה</option>
            {(techTax ?? []).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label_he}
              </option>
            ))}
          </select>
          <input
            name="jyears"
            type="number"
            min={0}
            defaultValue={jyears || ""}
            placeholder="שנות ניסיון (מינ')"
            className="px-3 py-2 rounded-md border border-ink-300 text-sm outline-none focus:border-brand-purple w-40"
          />
          <Button type="submit" size="sm">
            חיפוש
          </Button>
          {searching && (
            <Link href="/admin/mentor-requests" className="text-[12.5px] text-ink-500 hover:underline">
              ניקוי
            </Link>
          )}
        </form>
        {!searching && (
          <p className="text-[12px] text-ink-400">מלאי חיפוש כדי לראות תוצאות.</p>
        )}
        {searching &&
          (juniorResults.length > 0 ? (
            <div className="flex flex-col">
              {juniorResults.map((j) => (
                <div
                  key={j.id}
                  className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap"
                >
                  <Link
                    href={`/admin/members/${j.id}`}
                    className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                  >
                    {j.full_name}
                  </Link>
                  {j.specialization && <Badge variant="purple">{j.specialization}</Badge>}
                  {j.years != null && (
                    <span className="text-[12px] text-ink-500">{j.years} שנות ניסיון</span>
                  )}
                  <span className="flex gap-1 flex-wrap">
                    {j.tech.map((t) => (
                      <Badge key={t} variant="tech">
                        {techLabel.get(t) ?? t}
                      </Badge>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ink-500 text-sm py-1">לא נמצאו תוצאות לחיפוש הזה.</p>
          ))}
      </div>

      {handled.length > 0 && (
        <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
          <HandledRequestsList rows={handledRows} />
        </div>
      )}
    </div>
  );
}
