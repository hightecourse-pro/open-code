"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type MoveQuestionState = { error?: string };

/**
 * Move one profile question up or down. The order is what a member sees inside
 * each wizard section — and the order a hiring client reads the answers in.
 *
 * The seeded rows share sort_order values (several are 0), so a naive swap
 * between neighbours would be a silent no-op on a tie. The list is therefore
 * normalised to 0..n-1 first — relative order is preserved, and from then on
 * every swap is meaningful.
 */
export async function moveQuestion(
  id: string,
  direction: "up" | "down"
): Promise<MoveQuestionState> {
  await requireRole("admin");
  const supabase = await createClient();

  // Same ordering the configuration screen renders, so "up" means the row
  // she actually sees above this one.
  const { data: rows, error: readError } = await supabase
    .from("config_questions")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (readError) return { error: readError.message };

  const list = rows ?? [];
  const at = list.findIndex((q) => q.id === id);
  const to = direction === "up" ? at - 1 : at + 1;
  if (at === -1 || to < 0 || to >= list.length) return {};

  const [moved] = list.splice(at, 1);
  list.splice(to, 0, moved);

  // Its new index IS its new sort_order; touch only the rows whose number
  // actually changes (after the first normalisation that's just the two).
  for (const [i, q] of list.entries()) {
    if (q.sort_order === i) continue;
    const { error } = await supabase
      .from("config_questions")
      .update({ sort_order: i })
      .eq("id", q.id);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/config");
  return {};
}
