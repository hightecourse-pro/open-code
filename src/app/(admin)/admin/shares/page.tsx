import type { Metadata } from "next";
import Link from "next/link";
import { Share2, UserCheck, Zap, ZapOff, Eye, BookOpen, Search, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { isDriveAutomationConfigured } from "@/lib/drive-api";
import { markShareStatus, dismissShare, syncDriveNow } from "../content/actions";
import { removeShare } from "./actions";
import { ManualShareForm } from "./manual-share-form";

export const metadata: Metadata = { title: "תור שיתופים" };

/** DD.MM.YYYY — how dates read everywhere else in the admin. */
const DMY = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});
const dmy = (iso: string | null) => (iso ? DMY.format(new Date(iso)) : "—");

export default async function AdminSharesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const { view, q } = await searchParams;
  const byContent = view === "content";
  const needle = (q ?? "").trim().toLowerCase();

  const supabase = await createClient();
  // Cheap env check — no live Google call on every page render.
  const driveOn = isDriveAutomationConfigured();

  // Scoped queries instead of one unbounded select("*"): the table grows as
  // members × sessions, and past PostgREST's default row cap a single query
  // silently dropped the NEWEST rows — precisely where a just-created manual
  // grant lives, which is why it never showed up here. Everything is ordered
  // newest-first so a truncation can only ever lose ancient history.
  // select("*") stays, so a column added later still renders.
  const ROW_CAP = 2000;
  const [{ data: queueRows }, { data: sharedRows }, { data: manualRows }] = await Promise.all([
    supabase
      .from("content_shares")
      .select("*")
      .neq("status", "shared")
      .order("created_at", { ascending: false })
      .limit(ROW_CAP),
    supabase
      .from("content_shares")
      .select("*")
      .eq("status", "shared")
      .order("created_at", { ascending: false })
      .limit(ROW_CAP),
    // Manual grants get their own small query so they can never fall off a cap.
    supabase
      .from("content_shares")
      .select("*")
      .eq("status", "pending")
      .eq("granted_manually", true)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if ((queueRows ?? []).length === ROW_CAP || (sharedRows ?? []).length === ROW_CAP) {
    console.warn("[shares] row cap reached — the oldest rows are not shown on /admin/shares");
  }

  // The manual query overlaps the queue (both hold pending rows) — dedupe by id.
  const shares = [
    ...new Map([...(queueRows ?? []), ...(manualRows ?? [])].map((s) => [s.id, s])).values(),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));
  // "Who has what" also shows manual grants that haven't synced yet — the
  // admin decided them, so they must be visible (and removable) immediately.
  const live = [
    ...(sharedRows ?? []),
    ...shares.filter((s) => s.status === "pending" && s.granted_manually),
  ];

  const known = [...shares, ...(sharedRows ?? [])];
  const profileIds = [...new Set(known.map((s) => s.profile_id))];
  const courseIds = [...new Set(known.filter((s) => s.owner_type === "course").map((s) => s.owner_id))];
  const sessionIds = [...new Set(known.filter((s) => s.owner_type === "session").map((s) => s.owner_id))];

  const [{ data: profiles }, { data: courses }, { data: sessions }] = await Promise.all([
    profileIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [] }),
    courseIds.length ? supabase.from("courses").select("id, title").in("id", courseIds) : Promise.resolve({ data: [] }),
    sessionIds.length
      ? supabase.from("sessions").select("id, title").in("id", sessionIds)
      : Promise.resolve({ data: [] }),
  ]);

  // When she first walked in. Under "access on attempt" that date IS the
  // explanation of why the share exists. Null before the log migration runs —
  // the column then simply doesn't render.
  const { data: openStats } = await supabase
    .from("content_open_stats")
    .select("profile_id, owner_type, owner_id, first_open");
  const firstOpenOf = new Map(
    (openStats ?? []).map((r) => [`${r.profile_id}:${r.owner_type}:${r.owner_id}`, r.first_open])
  );

  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const titleOf = new Map<string, string>([
    ...(courses ?? []).map((c) => [`course:${c.id}`, c.title] as [string, string]),
    ...(sessions ?? []).map((s) => [`session:${s.id}`, s.title] as [string, string]),
  ]);

  const pending = shares.filter((s) => s.status === "pending");
  const revoked = shares.filter((s) => s.status === "revoked");

  // --- live shares, enriched and filtered ---------------------------------
  type LiveRow = (typeof live)[number] & { memberName: string; contentTitle: string };
  const liveRows: LiveRow[] = live.map((s) => ({
    ...s,
    memberName: nameOf.get(s.profile_id) ?? "—",
    contentTitle: titleOf.get(`${s.owner_type}:${s.owner_id}`) ?? "—",
  }));
  const filtered = needle
    ? liveRows.filter(
        (r) =>
          r.memberName.toLowerCase().includes(needle) || r.contentTitle.toLowerCase().includes(needle)
      )
    : liveRows;

  // Grouped both ways — the tabs just pick which grouping to render.
  const groups = new Map<string, { label: string; rows: LiveRow[] }>();
  for (const r of filtered) {
    const key = byContent ? `${r.owner_type}:${r.owner_id}` : r.profile_id;
    const label = byContent ? r.contentTitle : r.memberName;
    const g = groups.get(key) ?? { label, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  const grouped = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, "he"));
  const memberCount = new Set(filtered.map((r) => r.profile_id)).size;

  const tabHref = (v: "member" | "content") =>
    `/admin/shares?view=${v}${needle ? `&q=${encodeURIComponent(q ?? "")}` : ""}`;

  // Pickers for the manual-share form.
  const [{ data: members }, { data: allCourses }, { data: allSessions }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("status", ["active", "pending"])
      .order("full_name", { ascending: true }),
    supabase.from("courses").select("id, title").eq("is_published", true).order("title"),
    supabase.from("sessions").select("id, title").order("scheduled_at", { ascending: false }).limit(60),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;שיתופים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">תור שיתופים אישיים</h1>
        <p className="t-body-sm text-ink-500">
          כאן רואים למי צריך לשתף (או לבטל) קישורי Google Drive באופן אישי. השיתוף עצמו מתבצע בדרייב — כאן מסמנים שבוצע.
        </p>
      </div>

      {/* Automation status — when it's on, this queue should stay near-empty. */}
      {driveOn ? (
        <div className="flex items-start gap-2.5 bg-tint-mint border border-[#A7E3C6] rounded-md p-3.5 px-4 text-[13.5px] text-[#1B7A4B]">
          <Zap size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <b className="font-display">שיתוף אוטומטי פעיל.</b> הגישה נפתחת ברגע שחברה נכנסת
            לתוכן — לא בהצטרפות. לכן הרשימה כאן קצרה בכוונה: נשאר בה רק מה שלא הצליח וצריך טיפול
            ידני, ומה שצריך להסיר. מי שעוזבת מאבדת בדיוק את מה שהיא באמת פתחה. הסנכרון רץ פעם
            ביום — ולסנכרון מיידי אפשר ללחוץ &quot;סנכרון עכשיו&quot;.
          </div>
          <form action={syncDriveNow}>
            <Button type="submit" size="sm" variant="ghost">סנכרון עכשיו</Button>
          </form>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 bg-tint-warm border border-[#F0DCA8] rounded-md p-3.5 px-4 text-[13.5px] text-[#8C5E0E]">
          <ZapOff size={18} className="shrink-0 mt-0.5" />
          <span>
            <b className="font-display">שיתוף אוטומטי כבוי</b> — כרגע משתפים ידנית בדרייב ומסמנים כאן.
            כדי להפעיל אותו צריך להגדיר חשבון שירות של Google (ההוראות המלאות ב-
            <span className="font-mono text-[12px]" dir="ltr">docs/drive-automation.md</span>)
            ולהוסיף ב-Vercel את{" "}
            <span className="font-mono text-[12px]" dir="ltr">GOOGLE_SERVICE_ACCOUNT_EMAIL</span> ו-
            <span className="font-mono text-[12px]" dir="ltr">GOOGLE_PRIVATE_KEY</span>.
          </span>
        </div>
      )}

      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3 flex items-center gap-2">
          <Share2 size={16} className="text-brand-pink-deep" /> לשתף ({pending.length})
        </h3>
        {pending.length > 0 ? (
          <div className="flex flex-col">
            {pending.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
                <UserCheck size={16} className="text-brand-purple" />
                <span className="font-medium text-ink-900">{nameOf.get(s.profile_id) ?? "—"}</span>
                <Badge variant={s.owner_type === "course" ? "pink" : "purple"}>
                  {s.owner_type === "course" ? "קורס" : "סשן"}
                </Badge>
                <span className="text-ink-700 text-sm">{titleOf.get(`${s.owner_type}:${s.owner_id}`) ?? "—"}</span>
                <form action={markShareStatus.bind(null, s.id, "shared")} className="ms-auto">
                  <Button type="submit" size="sm">סימון כבוצע ✓</Button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-500 text-sm">אין שיתופים ממתינים 💜</p>
        )}
      </section>

      {/* ---------- Manual share — an extra course for one member ---------- */}
      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
        <div>
          <h3 className="font-display text-base font-bold flex items-center gap-2">
            <Gift size={16} className="text-brand-pink-deep" /> שיתוף אישי — קורס נוסף למשתתפת
          </h3>
          <p className="text-[12.5px] text-ink-500 mt-0.5">
            כאן את פותחת למישהי קורס או סשן מעבר לקורס הפעיל שלה. החלפת קורס לא נוגעת בו — הוא
            נשאר איתה. הוא נסגר כשאת מסירה אותו כאן, וגם מעצמו כשהיא עוזבת את הקהילה או כשהמנוי
            שלה מסתיים.
          </p>
        </div>
        <ManualShareForm
          members={(members ?? []).map((m) => ({ id: m.id, label: m.full_name }))}
          courses={(allCourses ?? []).map((c) => ({ id: c.id, label: c.title }))}
          sessions={(allSessions ?? []).map((s) => ({ id: s.id, label: s.title }))}
        />
      </section>

      {/* ---------- Who has what — the live picture ---------- */}
      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Eye size={16} className="text-brand-purple" /> מה משותף למי
            </h3>
            <p className="text-[12.5px] text-ink-500 mt-0.5">
              {filtered.length > 0
                ? `${memberCount} משתתפות · ${filtered.length} שיתופים פעילים`
                : "כאן מופיע כל תוכן שמישהי באמת פתחה. ריק? פשוט עוד לא נכנסו 💜"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-md border border-ink-200 overflow-hidden">
              <Link
                href={tabHref("member")}
                className={cn(
                  "px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  !byContent ? "bg-brand-gradient text-white" : "text-ink-700 hover:bg-ink-50"
                )}
              >
                לפי משתתפת
              </Link>
              <Link
                href={tabHref("content")}
                className={cn(
                  "px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  byContent ? "bg-brand-gradient text-white" : "text-ink-700 hover:bg-ink-50"
                )}
              >
                לפי תוכן
              </Link>
            </div>
            <form className="flex items-center gap-1.5">
              {byContent && <input type="hidden" name="view" value="content" />}
              <div className="relative">
                <Search size={13} className="absolute start-2 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="חיפוש שם או תוכן…"
                  className="text-[12.5px] border border-ink-300 rounded-md ps-7 pe-2 py-1.5 w-44"
                />
              </div>
              <Button type="submit" size="sm" variant="ghost">חיפוש</Button>
            </form>
          </div>
        </div>

        {grouped.length === 0 ? (
          <p className="text-ink-500 text-sm">
            {needle
              ? "לא מצאנו שיתוף שמתאים לחיפוש — אולי לנסות מילה אחרת?"
              : "עדיין אין שיתופים פעילים. ברגע שמשתתפת תיכנס לקורס או להקלטה, זה יופיע כאן 💜"}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {grouped.map((g) => (
              <div key={g.label} className="border border-ink-200 rounded-[14px] overflow-hidden">
                <div className="flex items-center gap-2 bg-ink-50 px-3.5 py-2">
                  {byContent ? (
                    <BookOpen size={14} className="text-brand-pink-deep" />
                  ) : (
                    <UserCheck size={14} className="text-brand-purple" />
                  )}
                  <span className="font-display font-bold text-[13.5px] text-ink-1000">{g.label}</span>
                  <span className="text-[11.5px] text-ink-500">
                    {byContent ? `${g.rows.length} משתתפות` : `${g.rows.length} פריטים`}
                  </span>
                </div>
                <ul className="divide-y divide-ink-100">
                  {g.rows.map((r) => (
                    <li key={r.id} className="flex items-center gap-2.5 px-3.5 py-2 flex-wrap">
                      <Badge variant={r.owner_type === "course" ? "pink" : "purple"}>
                        {r.owner_type === "course" ? "קורס" : "סשן"}
                      </Badge>
                      <span className="text-[13px] text-ink-900">
                        {byContent ? r.memberName : r.contentTitle}
                      </span>
                      {r.granted_manually && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-pink-deep bg-tint-pink border border-[#F3C6DD] rounded-full px-2 py-px">
                          <Gift size={11} /> שיתוף אישי
                        </span>
                      )}
                      {r.granted_email && (
                        <span className="text-[11.5px] text-ink-400" dir="ltr">
                          {r.granted_email}
                        </span>
                      )}
                      <span className="text-[11.5px] text-ink-400">
                        {r.status === "shared" ? `שותף ${dmy(r.shared_at)}` : "ממתין לשיתוף בדרייב"}
                      </span>
                      {firstOpenOf.has(`${r.profile_id}:${r.owner_type}:${r.owner_id}`) && (
                        <span className="text-[11.5px] text-ink-400">
                          נפתח לראשונה{" "}
                          {dmy(firstOpenOf.get(`${r.profile_id}:${r.owner_type}:${r.owner_id}`) ?? null)}
                        </span>
                      )}
                      <form action={removeShare.bind(null, r.id)} className="ms-auto">
                        <button
                          type="submit"
                          className="text-[11.5px] text-ink-400 hover:text-danger transition-colors"
                        >
                          ביטול שיתוף
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {revoked.length > 0 && (
        <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
          <h3 className="font-display text-base font-bold mb-3">לבטל שיתוף ({revoked.length})</h3>
          <div className="flex flex-col">
            {revoked.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
                <span className="font-medium text-ink-900">{nameOf.get(s.profile_id) ?? "—"}</span>
                <Badge variant={s.owner_type === "course" ? "pink" : "purple"}>
                  {s.owner_type === "course" ? "קורס" : "סשן"}
                </Badge>
                <span className="text-ink-700 text-sm">{titleOf.get(`${s.owner_type}:${s.owner_id}`) ?? "—"}</span>
                <form action={dismissShare.bind(null, s.id)} className="ms-auto">
                  <Button type="submit" variant="ghost" size="sm">סימון כבוטל</Button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
