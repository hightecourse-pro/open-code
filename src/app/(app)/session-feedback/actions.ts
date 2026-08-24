"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * "היית איתנו בסשן?" — both answers are stored (a "לא" simply closes the ask
 * for that session); ratings ride along only with a yes. One row per
 * (session, member), first answer wins.
 */
export async function submitSessionFeedback(
  sessionId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const attended = String(formData.get("attended")) === "yes";
  const rating = (name: string): number | null => {
    const n = Number(formData.get(name));
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000) || null;

  if (attended && !(rating("content") && rating("practical") && rating("clarity") && rating("speaker"))) {
    return { error: "עוד רגע — סמני דירוג בכל אחת מארבע השורות 🙂" };
  }

  const { error } = await supabase.from("session_feedback").insert({
    session_id: sessionId,
    profile_id: user.id,
    attended,
    content_rating: attended ? rating("content") : null,
    practical_rating: attended ? rating("practical") : null,
    clarity_rating: attended ? rating("clarity") : null,
    speaker_rating: attended ? rating("speaker") : null,
    comment: attended ? comment : null,
  });
  // A duplicate answer (double click, two tabs) is already a success.
  if (error && !error.message.includes("duplicate")) {
    return { error: "משהו השתבש — נסי שוב עוד רגע." };
  }

  revalidatePath("/", "layout");
  return {};
}
