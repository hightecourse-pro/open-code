import type { Metadata } from "next";
import Image from "next/image";
import localFont from "next/font/local";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminLogin } from "./login";
import { Dashboard, type QuizRow } from "./dashboard";
import { H } from "../theme";

export const metadata: Metadata = {
  title: "ניהול שאלון הקורס | הייטקורס",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const rubik = localFont({ src: "../fonts/Rubik-Variable.ttf", weight: "300 900", display: "swap" });

/*
  The Hightecourse admin for the AI-course quiz - its OWN management screen
  (the owner, 20/10: "מערכת ניהול שונה של הייטקורס"), deliberately outside the
  Open Code admin shell and styled in the Hightecourse language. Entry uses
  the very same username+password (same Supabase auth, admin role required);
  anyone else sees the login, admins see the dashboard.
*/
export default async function AiCourseAdminPage() {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  let rows: QuizRow[] = [];
  if (isAdmin) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_course_quiz_submissions")
      .select(
        "id, email, first_name, last_name, signup_status, questions_done, score, recommendation, wants_placement, downloaded_syllabus, completed_at, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(2000);
    rows = (data ?? []) as QuizRow[];
  }

  return (
    <div dir="rtl" className={`${rubik.className} flex min-h-screen flex-col`} style={{ background: "#F6F8FA" }}>
      <header className="w-full bg-white" style={{ borderBottom: `3px solid ${H.yellow}` }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <Image
            src="/ai-course/hightecourse.png"
            alt="הייטקורס - לחשוב בגדול"
            width={170}
            height={50}
            priority
            style={{ height: "auto", width: 150 }}
          />
          <span className="text-[15px] font-black" style={{ color: H.navy }}>
            ניהול שאלון קורס ה-AI
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {isAdmin ? <Dashboard rows={rows} /> : <AdminLogin />}
      </main>

      <footer className="w-full" style={{ background: H.navy }}>
        <div className="mx-auto max-w-5xl px-4 py-3 text-center text-[13px] text-white">
          <span className="font-bold" style={{ color: H.yellow }}>
            הייטקורס
          </span>
          <span> · מערכת ניהול פנימית</span>
        </div>
      </footer>
    </div>
  );
}
