"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

/** Hand-award bonus points to a mentor (negative fixes a mistake). */
export async function addMentorBonus(mentorId: string, formData: FormData): Promise<void> {
  const me = await requireRole("admin");
  const points = Math.round(Number(formData.get("points")));
  if (!Number.isFinite(points) || points === 0 || Math.abs(points) > 1000) return;
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200) || null;
  const supabase = await createClient();
  await supabase.from("mentor_bonus_points").insert({
    mentor_id: mentorId,
    points,
    reason,
    created_by: me.id,
  });
  revalidatePath("/admin/mentors");
  revalidatePath("/members");
}
