import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Badge, Button, Select } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { mentorReasonLabel } from "@/lib/mentor-requests";
import { assignMentorToRequest, setMentorRequestStatus } from "../actions";

export const metadata: Metadata = { title: "בקשות למנטורית" };

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
  const supabase = await createClient();
  const { data: juniors } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_initials, specialization")
    .eq("role", "junior")
    .eq("status", "active")
    .eq("profile_completed", true)
    .order("full_name");
  if (!juniors?.length) return [];

  const { data: qs } = await supabase
    .from("config_questions")
    .select("id, key")
    .in("key", ["years_experience", "dev_tech", "exp_tech", "tech_stack", "genai_practiced"]);
  const keyOf = new Map((qs ?? []).map((r) => [r.id, r.key]));
  const { data: answers } = await supabase
    .from("profile_answers")
    .select("profile_id, question_id, value")
    .in("question_id", (qs ?? []).map((r) => r.id))
    .in("profile_id", juniors.map((j) => j.id));

  const techOf = new Map<string, Set<string>>();
  const yearsOf = new Map<string, number>();
  for (const a of answers ?? []) {
    const key = keyOf.get(a.question_id);
    if (key === "years_experience" && typeof a.value === "number") {
      yearsOf.set(a.profile_id, a.value);
    } else if (Array.isArray(a.value)) {
      const s = techOf.get(a.profile_id) ?? new Set<string>();
      for (const v of a.value as string[]) s.add(String(v));
      techOf.set(a.profile_id, s);
    }
  }

  const needle = q.trim();
  return juniors
    .filter((j) => {
      if (needle && !`${j.full_name} ${j.specialization ?? ""}`.includes(needle)) return false;
      if (tech && !techOf.get(j.id)?.has(tech)) return false;
      if (minYears > 0 && (yearsOf.get(j.id) ?? 0) < minYears) return false;
      return true;
    })
    .slice(0, 30)
    .map((j) => ({
      ...j,
      years: yearsOf.get(j.id) ?? null,
      tech: [...(techOf.get(j.id) ?? [])].slice(0, 5),
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
      .select("id, profile_id, reason, note, status, kind, assigned_mentor_id, created_at")
      .order("status", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name")
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

  const [juniorResults, { data: techTax }] = await Promise.all([
    searching ? searchJuniors(jq, jtech, jyears) : Promise.resolve([]),
    supabase.from("config_taxonomies").select("value, label_he").eq("kind", "tech").order("label_he"),
  ]);
  const techLabel = new Map((techTax ?? []).map((t) => [t.value, t.label_he]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;בקשות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">בקשות למנטורית</h1>
        <p className="t-body-sm text-ink-500">
          חברות שביקשו שנחבר אותן למנטורית. שיוך מנטורית מעדכן את החברה במייל ומסמן כטופל.
        </p>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">
          ממתינות לטיפול ({open.length})
        </h3>
        {open.length > 0 ? (
          <div className="flex flex-col">
            {open.map((r) => {
              const m = memberOf.get(r.profile_id);
              return (
                <div key={r.id} className="flex flex-col gap-1.5 py-3.5 border-b border-ink-100 last:border-b-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link
                      href={`/admin/members/${r.profile_id}`}
                      className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                    >
                      {m?.full_name ?? "חברת קהילה"}
                    </Link>
                    {m?.specialization && <Badge variant="tech">{m.specialization}</Badge>}
                    <KindBadge kind={r.kind} />
                    <Badge variant="pink">{mentorReasonLabel(r.reason)}</Badge>
                    <span className="text-[11px] text-ink-500">{timeAgo(r.created_at)}</span>
                    <div className="ms-auto flex gap-1.5">
                      <form action={setMentorRequestStatus.bind(null, r.id, "handled")}>
                        <Button type="submit" size="sm" variant="ghost">סימון כטופל</Button>
                      </form>
                    </div>
                  </div>
                  {r.note && (
                    <div className="bg-ink-50 border border-ink-100 rounded-md px-3 py-2 text-[13px] text-ink-700">
                      {r.note}
                    </div>
                  )}
                  {(mentors ?? []).length > 0 ? (
                    <form
                      action={assignMentorToRequest.bind(null, r.id)}
                      className="flex items-center gap-2 flex-wrap"
                    >
                      <div className="w-56 max-w-full">
                        <Select name="mentor_id" required defaultValue="" className="!py-2 text-[13px]">
                          <option value="" disabled>
                            בחירת מנטורית לליווי…
                          </option>
                          {(mentors ?? []).map((mm) => (
                            <option key={mm.id} value={mm.id}>
                              {mm.full_name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button type="submit" size="sm">
                        שיוך מנטורית 👑
                      </Button>
                    </form>
                  ) : (
                    <span className="text-[12px] text-ink-500">אין כרגע מנטוריות פעילות לשיוך.</span>
                  )}
                  <Link
                    href={`/chat`}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-purple hover:underline w-fit"
                  >
                    <MessageCircle size={13} /> לצ&apos;אטים
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm py-2">אין בקשות פתוחות כרגע 💜</p>
        )}
      </div>

      {/* The matching aid the owner asked for: find the right junior by the
          things a match hangs on — name, technology, years. */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">חיפוש בין הג&#39;וניוריות</h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          לחיפוש התאמה למנטורית — לפי שם, טכנולוגיה ושנות ניסיון.
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
          <Button type="submit" size="sm">חיפוש</Button>
          {searching && (
            <Link href="/admin/mentor-requests" className="text-[12.5px] text-ink-500 hover:underline">
              ניקוי
            </Link>
          )}
        </form>
        {searching &&
          (juniorResults.length > 0 ? (
            <div className="flex flex-col">
              {juniorResults.map((j) => (
                <div key={j.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap">
                  <Link
                    href={`/admin/members/${j.id}`}
                    className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                  >
                    {j.full_name}
                  </Link>
                  {j.specialization && <Badge variant="purple">{j.specialization}</Badge>}
                  {j.years != null && <span className="text-[12px] text-ink-500">{j.years} שנות ניסיון</span>}
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
          <h3 className="font-display text-base font-bold mb-3">טופלו ({handled.length})</h3>
          <div className="flex flex-col">
            {handled.map((r) => {
              const m = memberOf.get(r.profile_id);
              const assigned = r.assigned_mentor_id ? memberOf.get(r.assigned_mentor_id) : null;
              return (
                <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap opacity-70">
                  <Link
                    href={`/admin/members/${r.profile_id}`}
                    className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                  >
                    {m?.full_name ?? "חברת קהילה"}
                  </Link>
                  <KindBadge kind={r.kind} />
                  <Badge variant="tech">{mentorReasonLabel(r.reason)}</Badge>
                  {assigned && (
                    <span className="text-[12px] font-semibold text-[#8C5E0E]">
                      👑 {assigned.full_name}
                    </span>
                  )}
                  <span className="text-[11px] text-ink-500">{timeAgo(r.created_at)}</span>
                  <form action={setMentorRequestStatus.bind(null, r.id, "open")} className="ms-auto">
                    <Button type="submit" size="sm" variant="ghost">החזרה לטיפול</Button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
