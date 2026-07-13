"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FIELD_VALIDATORS } from "@/lib/validators";
import type { Json } from "@/types/database";

export type ProfileState = { ok?: boolean; error?: string };

/** Set the member's daily-digest email preference. */
export async function setDigestFrequency(freq: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const valid = ["daily", "unread", "off"].includes(freq) ? freq : "daily";
  await supabase.from("profiles").update({ digest_frequency: valid }).eq("id", user.id);
  revalidatePath("/profile");
}

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  if (firstName.length < 1 || lastName.length < 1) {
    return { error: "נשמח לדעת איך קוראים לך 🙂 (שם פרטי ושם משפחה)" };
  }
  const fullName = `${firstName} ${lastName}`.trim();

  // Was this the first-login mandatory completion?
  const { data: before } = await supabase
    .from("profiles")
    .select("profile_completed")
    .eq("id", user.id)
    .single();
  const firstCompletion = !before?.profile_completed;

  const { data: questions } = await supabase
    .from("config_questions")
    .select("id, key, label_he, field_type, required, depends_on, intake_track, active")
    .eq("active", true);

  // Resolve each answer (handling "אחר" free-text), and validate required ones.
  const answered: { question_id: string; value: Json }[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];
  const boolByKey = new Map<string, boolean>();
  for (const q of questions ?? []) {
    if (q.field_type === "bool") {
      boolByKey.set(q.key, formData.get(`q_${q.id}`) === "on");
    }
  }
  const hasExperience = boolByKey.get("has_experience") ?? false;

  for (const q of questions ?? []) {
    const key = `q_${q.id}`;
    // Skip questions hidden by the experience track — don't require/store them.
    if (q.intake_track === "junior" && hasExperience) continue;
    if (q.intake_track === "experienced" && !hasExperience) continue;
    // Skip conditional follow-ups whose parent bool is off — don't require them.
    if (q.depends_on && !boolByKey.get(q.depends_on)) continue;

    let value: Json;
    let empty = false;

    if (q.field_type === "multiselect" || q.field_type === "tags") {
      let values = formData.getAll(key).map(String);
      if (values.includes("other")) {
        const other = String(formData.get(`${key}__other`) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        values = values.filter((v) => v !== "other").concat(other);
      }
      value = values;
      empty = values.length === 0;
    } else if (q.field_type === "number") {
      const raw = formData.get(key);
      const n = Number(raw);
      value = raw === null || raw === "" || !Number.isFinite(n) ? null : n;
      empty = value === null;
    } else if (q.field_type === "bool") {
      value = boolByKey.get(q.key) ?? false;
      empty = false; // a "no" is a valid answer
    } else if (q.field_type === "select") {
      let v = String(formData.get(key) ?? "");
      if (v === "other") v = String(formData.get(`${key}__other`) ?? "").trim();
      value = v;
      empty = v === "";
    } else {
      const v = String(formData.get(key) ?? "").trim();
      value = v;
      empty = v === "";
    }

    if (q.required && empty) missing.push(q.label_he);
    const check = FIELD_VALIDATORS[q.key];
    if (check && typeof value === "string") {
      const msg = check(value);
      if (msg) invalid.push(msg);
    }
    answered.push({ question_id: q.id, value });
  }

  if (invalid.length > 0) {
    return { error: invalid.join(" · ") };
  }
  if (missing.length > 0) {
    return { error: `נשארו עוד שדות חובה למלא: ${missing.slice(0, 6).join(", ")}` };
  }

  await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      avatar_initials: firstName.slice(0, 1),
      is_experienced: hasExperience,
      profile_completed: true,
    })
    .eq("id", user.id);

  for (const a of answered) {
    await supabase
      .from("profile_answers")
      .upsert(
        { profile_id: user.id, question_id: a.question_id, value: a.value },
        { onConflict: "profile_id,question_id" }
      );
  }

  revalidatePath("/profile");
  // On first completion, drop the onboarding gate and land in the community.
  if (firstCompletion) redirect("/forum");
  return { ok: true };
}
