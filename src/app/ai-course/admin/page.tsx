import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Brand, PageFooter } from "../chrome";
import { rubik } from "../font";
import { H } from "../theme";
import { AdminLogin, NotAdmin } from "./login";
import { Dashboard, type QuizEvent, type QuizRow } from "./dashboard";

export const metadata: Metadata = {
  title: { absolute: "ניהול שאלון הקורס | הייטקורס" },
  robots: { index: false, follow: false },
  icons: { icon: "/ai-course/icon.png" },
};
export const dynamic = "force-dynamic";

/*
  The Hightecourse admin for the AI-course quiz - its OWN management screen
  (the owner, 20/10: "מערכת ניהול שונה של הייטקורס"), deliberately outside the
  Open Code admin shell and styled in the Hightecourse language. Entry uses
  the very same email+password (same Supabase auth, admin role required):
  a visitor sees the login, a signed-in non-admin is told so, admins see the
  dashboard - including the client-side failures the quiz reported.
*/
// (a helper: react-hooks/purity forbids Date.now() in a component body)
function twoWeeksAgo(): string {
  return new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
}

export default async function AiCourseAdminPage() {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  let rows: QuizRow[] = [];
  let events: QuizEvent[] = [];
  if (isAdmin) {
    const admin = createAdminClient();
    const since = twoWeeksAgo();
    const [subs, evs] = await Promise.all([
      admin
        .from("ai_course_quiz_submissions")
        .select("id, email, first_name, last_name, signup_status, answers, questions_done, score, recommendation, wants_placement, downloaded_syllabus, completed_at, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(2000),
      admin.from("ai_course_quiz_events").select("id, kind, submission_id, step, message, digest, user_agent, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    ]);
    rows = (subs.data ?? []) as QuizRow[];
    events = (evs.data ?? []) as QuizEvent[];
  }

  return (
    <div dir="rtl" className={`${rubik.className} flex min-h-screen flex-col`} style={{ background: H.bg, color: H.ink }}>
      <Brand
        wide
        right={
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-black" style={{ color: H.navy }}>
              ניהול שאלון קורס ה-AI
            </span>
            <Link href="/ai-course" className="text-[13px] font-medium underline" style={{ color: H.muted }}>
              לשאלון
            </Link>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {isAdmin ? <Dashboard rows={rows} events={events} /> : profile ? <NotAdmin name={profile.first_name || profile.full_name || ""} /> : <AdminLogin />}
      </main>

      <PageFooter wide />
    </div>
  );
}
