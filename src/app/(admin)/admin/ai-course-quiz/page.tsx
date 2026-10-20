import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuizTable, type QuizRow } from "./quiz-table";

export const metadata: Metadata = { title: "שאלון קורס AI" };
export const dynamic = "force-dynamic";

/*
  שאלון קורס AI (the owner, 20/10): every woman who opened the public
  /ai-course quiz - who she is, whether she is already registered to the
  course, how far she got (including mid-form abandonment), which track the
  quiz recommended, and whether she asked to be placed. Admin-only, with the
  same login as everything else here.
*/
export default async function AiCourseQuizAdminPage() {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_course_quiz_submissions")
    .select(
      "id, email, first_name, last_name, signup_status, questions_done, score, recommendation, wants_placement, downloaded_syllabus, completed_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  return <QuizTable rows={(data ?? []) as QuizRow[]} />;
}
