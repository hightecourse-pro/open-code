"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function toggleSaveJob(jobId: string, save: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (save) {
    await supabase.from("saved_jobs").insert({ job_id: jobId, profile_id: user.id });
  } else {
    await supabase.from("saved_jobs").delete().eq("job_id", jobId).eq("profile_id", user.id);
  }
  revalidatePath("/jobs");
}

export async function applyToJob(jobId: string): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("applications")
    .insert({ job_id: jobId, applicant_id: user.id, status: "submitted" });

  revalidatePath("/jobs");
  if (error) return { error: "כבר הגשת למשרה הזו 💜" };
  return { ok: true };
}
