"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type ProfileState = { ok?: boolean; error?: string };

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName.length < 2) return { error: "נשמח לדעת איך קוראים לך 🙂" };

  // Was this the first-login mandatory completion?
  const { data: before } = await supabase
    .from("profiles")
    .select("profile_completed")
    .eq("id", user.id)
    .single();
  const firstCompletion = !before?.profile_completed;

  await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      avatar_initials: fullName.slice(0, 1),
      profile_completed: true,
    })
    .eq("id", user.id);

  const { data: questions } = await supabase
    .from("config_questions")
    .select("id, field_type")
    .eq("active", true);

  for (const q of questions ?? []) {
    const key = `q_${q.id}`;
    let value: Json;
    if (q.field_type === "multiselect" || q.field_type === "tags") {
      value = formData.getAll(key).map(String);
    } else if (q.field_type === "number") {
      const n = Number(formData.get(key));
      value = Number.isFinite(n) ? n : null;
    } else if (q.field_type === "bool") {
      value = formData.get(key) === "on";
    } else {
      value = String(formData.get(key) ?? "");
    }

    await supabase
      .from("profile_answers")
      .upsert({ profile_id: user.id, question_id: q.id, value }, { onConflict: "profile_id,question_id" });
  }

  revalidatePath("/profile");
  // On first completion, drop the onboarding gate and land in the community.
  if (firstCompletion) redirect("/feed");
  return { ok: true };
}
