import type { Metadata } from "next";
import { Info, Play, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { CourseCard } from "@/components/patterns/course-card";
import { CourseContent } from "@/components/patterns/course-content";
import { LoggedLink } from "@/components/patterns/logged-link";
import { UpgradeCard } from "@/components/patterns/upgrade-prompt";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { returnCourse } from "./actions";
import { COURSE_DATE_HE, swapEligibleAt } from "@/lib/course-library";
import type { ContentLink } from "@/types/database";

export const metadata: Metadata = { title: "ספריית הקורסים" };

export default async function CoursesPage() {
  const supabase = await createClient();
  const user = await getUser();
  const profile = await requireCommunityAccess();
  // The library is a junior benefit; mentors get sessions and recordings. The
  // sidebar hides this tab for them — this covers a typed-in URL.
  if (profile.role === "mentor") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <span className="font-mono text-xs text-brand-pink-deep">&lt;קורסים/&gt;</span>
          <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ספריית הקורסים</h1>
        </div>
        <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm text-[14.5px] text-ink-700 leading-relaxed">
          ספריית הקורסים מיועדת לחברות הקהילה במסלול מנוי 💜 בתור מנטורית פתוחים לך הסשנים,
          ההקלטות, הפורום והצ&apos;אט — ואם מתחשק לך קורס מסוים, כתבי לנו ונפתח אותו עבורך אישית.
        </div>
      </div>
    );
  }
  const subscriber = isSubscriber(profile);

  const [{ data: courses }, { data: active }] = await Promise.all([
    supabase.from("courses").select("*").eq("is_published", true).order("created_at", { ascending: true }),
    user && subscriber
      ? supabase
          .from("enrollments")
          .select("id, course_id, progress_pct, last_switch_month, studied, rating, feedback, started_at, created_at")
          .eq("profile_id", user.id)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const activeCourse = active ? (courses ?? []).find((c) => c.id === active.course_id) : null;

  // The library rule, printed instead of implied: when the rolling month since
  // she took the current course hasn't passed, every other card carries the
  // exact date her swap unlocks.
  const eligibleAt = active ? swapEligibleAt(active.started_at ?? active.created_at) : null;
  const swapReady = !eligibleAt || eligibleAt <= new Date();
  const swapEligibleIso = eligibleAt && !swapReady ? eligibleAt.toISOString() : null;

  // Unit (קוביה) headers for every course — the cards show the year cycles.
  // Tolerates the table not existing yet (pre-migration deploys).
  const { data: allUnits } = await supabase
    .from("course_units")
    .select("id, course_id, name, year, sort_order")
    .order("sort_order", { ascending: true });
  const unitsByCourse = new Map<string, { id: string; name: string; year: number | null }[]>();
  for (const u of allUnits ?? []) {
    const arr = unitsByCourse.get(u.course_id) ?? [];
    arr.push({ id: u.id, name: u.name, year: u.year });
    unitsByCourse.set(u.course_id, arr);
  }

  // Load the active course's Drive links (videos + materials folders).
  let activeLinks: ContentLink[] = [];
  if (activeCourse) {
    const { data } = await supabase
      .from("content_links")
      .select("*")
      .eq("owner_type", "course")
      .eq("owner_id", activeCourse.id)
      .order("sort_order", { ascending: true });
    activeLinks = data ?? [];
  }

  // Group the active course's links into its units; legacy links stay flat.
  const activeUnits = (unitsByCourse.get(activeCourse?.id ?? "") ?? []).map((u) => ({
    ...u,
    links: activeLinks.filter((l) => l.unit_id === u.id),
  }));
  const legacyLinks = activeLinks.filter((l) => !l.unit_id);

  // Courses an admin opened for her personally — extra, on top of the active
  // one. They survive the monthly swap, and end when an admin removes them or
  // when she leaves the community / stops paying.
  // One read, two jobs: which courses an admin opened for her personally, and
  // which ones she has already unlocked in Drive (those skip the gate).
  const { data: myShares } = user
    ? await supabase
        .from("content_shares")
        .select("owner_id, status, granted_manually")
        .eq("profile_id", user.id)
        .eq("owner_type", "course")
        .neq("status", "revoked")
    : { data: [] };
  const gifted = (myShares ?? []).filter((s) => s.granted_manually);
  const unlockedCourses = new Set(
    (myShares ?? []).filter((s) => s.status === "shared").map((s) => s.owner_id)
  );
  const giftedIds = [...new Set(gifted.map((g) => g.owner_id))].filter(
    (id) => id !== activeCourse?.id
  );
  const giftedCourses = (courses ?? []).filter((c) => giftedIds.includes(c.id));

  let giftedLinks: ContentLink[] = [];
  if (giftedCourses.length) {
    const { data } = await supabase
      .from("content_links")
      .select("*")
      .eq("owner_type", "course")
      .in("owner_id", giftedCourses.map((c) => c.id))
      .order("sort_order", { ascending: true });
    giftedLinks = data ?? [];
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;קורסים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ספריית הקורסים</h1>
        <p className="t-body-sm text-ink-700">קורס פעיל אחד בכל פעם — כמו ספרייה. אפשר להחליף פעם בחודש.</p>
      </div>

      {!subscriber && (
        <UpgradeCard
          title="ספריית הקורסים נפתחת עם מנוי"
          body="את מוזמנת לראות מה יש בספרייה. עם מנוי תוכלי לפתוח קורס וללמוד בקצב שלך, ולהחליף אותו פעם בחודש."
        />
      )}

      {activeCourse && (
        <div className="relative overflow-hidden bg-brand-gradient rounded-[22px] p-6 text-white shadow-glow-pink flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          <div className="w-[120px] h-[80px] rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 border border-white/25">
            <Play size={28} fill="white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[11px] opacity-80">הקורס הפעיל שלך</div>
            <div className="font-display text-[22px] font-black my-1">{activeCourse.title}</div>
            <div className="text-[13px] opacity-85 mb-2">{activeCourse.lessons_count} שיעורים</div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden max-w-[300px]">
              <div className="h-full bg-white rounded-full" style={{ width: `${active?.progress_pct ?? 0}%` }} />
            </div>
            <div className="text-xs opacity-85 mt-1.5">השלמת {active?.progress_pct ?? 0}% מהקורס</div>
            <div className="text-xs opacity-85 mt-1">
              {swapReady
                ? "זכאות ההחלפה שלך פתוחה — אפשר לבחור קורס אחר מהספרייה 📚"
                : `זכאות החלפת קורס: ${COURSE_DATE_HE.format(eligibleAt!)}`}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:ms-auto">
            {/* Only once she really holds the Drive share — otherwise this
                button would land her on Google's sign-in screen. Before that
                the gate below is the way in. */}
            {activeLinks.length > 0 && unlockedCourses.has(activeCourse.id) && (
              <LoggedLink
                href={activeLinks[0].url}
                ownerType="course"
                ownerId={activeCourse.id}
                linkId={activeLinks[0].id}
                className="font-display font-semibold text-[13.5px] px-[18px] py-2.5 rounded-md bg-white text-brand-pink-deep text-center"
              >
                המשיכי לקורס
              </LoggedLink>
            )}
            <form action={returnCourse}>
              <button
                type="submit"
                className="w-full font-display font-semibold text-[13.5px] px-[18px] py-2.5 rounded-md bg-white/[0.18] text-white backdrop-blur"
              >
                החזרת קורס
              </button>
            </form>
          </div>
        </div>
      )}

      {activeCourse && (
        <CourseContent
          courseId={activeCourse.id}
          links={legacyLinks}
          units={activeUnits}
          studied={active?.studied ?? false}
          rating={active?.rating ?? null}
          feedback={active?.feedback ?? null}
          unlocked={unlockedCourses.has(activeCourse.id)}
        />
      )}

      {/* Personally opened for her by the team — not part of the monthly swap. */}
      {giftedCourses.map((course) => {
        const links = giftedLinks.filter((l) => l.owner_id === course.id);
        const units = (unitsByCourse.get(course.id) ?? []).map((u) => ({
          ...u,
          links: links.filter((l) => l.unit_id === u.id),
        }));
        return (
          <div key={course.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Gift size={16} className="text-brand-pink-deep" />
              <h2 className="font-display text-lg font-bold text-ink-1000">{course.title}</h2>
              <span className="text-[12px] font-semibold text-brand-pink-deep bg-tint-pink border border-[#F3C6DD] rounded-full px-2.5 py-0.5">
                נפתח עבורך אישית 💜
              </span>
            </div>
            <CourseContent
              courseId={course.id}
              links={links.filter((l) => !l.unit_id)}
              units={units}
              studied={false}
              rating={null}
              feedback={null}
              unlocked={unlockedCourses.has(course.id)}
            />
          </div>
        );
      })}

      <div className="flex gap-2.5 items-start bg-tint-purple border border-[#DDC9EC] rounded-md p-3.5 px-4 text-[13.5px] text-ink-700">
        <Info size={18} className="text-brand-purple shrink-0 mt-0.5" />
        <span>
          <b className="font-display text-brand-purple">איך זה עובד:</b> את בוחרת קורס אחד ולומדת בקצב שלך.
          בכל חודש אפשר להחליף לקורס אחר — הקורס הקודם ייסגר והחדש ייפתח.
        </span>
      </div>

      <h2 className="font-display text-lg font-bold text-ink-1000">כל הקורסים</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(courses ?? []).map((course) => {
          const units = unitsByCourse.get(course.id) ?? [];
          const years = [...new Set(units.map((u) => u.year).filter(Boolean))] as number[];
          const cycles =
            units.length > 1
              ? `${units.length} מחזורים${years.length ? ` · ${Math.min(...years)}–${Math.max(...years)}` : ""}`
              : years.length
                ? `מחזור ${years[0]}`
                : null;
          return (
            <CourseCard
              key={course.id}
              course={course}
              cycles={cycles}
              gifted={giftedIds.includes(course.id)}
              locked={!!activeCourse && activeCourse.id !== course.id}
              swapEligibleAt={swapEligibleIso}
              needsSubscription={!subscriber}
            />
          );
        })}
      </div>
    </div>
  );
}
