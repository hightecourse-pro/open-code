"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { groupBySection } from "@/lib/profile-sections";

export type MoveQuestionState = { error?: string };

/**
 * Move one profile question up or down **within its wizard step**.
 *
 * The questionnaire is a sequence of titled steps and a question belongs to one
 * by its key, so moving a question past the end of its step would not move it
 * anywhere a member could see — the steps themselves are fixed. The swap is
 * therefore confined to the step, which is also what the configuration screen
 * now shows.
 *
 * Afterwards every row is renumbered along the flattened step order, so
 * sort_order and the rendered order can never drift apart again.
 */
export async function moveQuestion(
  id: string,
  direction: "up" | "down"
): Promise<MoveQuestionState> {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: rows, error: readError } = await supabase
    .from("config_questions")
    .select("id, key, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (readError) return { error: readError.message };

  const sections = groupBySection(rows ?? []);
  const section = sections.find((s) => s.questions.some((q) => q.id === id));
  if (!section) return {};

  const at = section.questions.findIndex((q) => q.id === id);
  const to = direction === "up" ? at - 1 : at + 1;
  // Already at the edge of its step — there is nowhere inside it to go.
  if (to < 0 || to >= section.questions.length) return {};

  const [moved] = section.questions.splice(at, 1);
  section.questions.splice(to, 0, moved);

  // Its index in the flattened wizard IS its new sort_order; touch only the
  // rows whose number actually changes.
  const flat = sections.flatMap((s) => s.questions);
  for (const [i, q] of flat.entries()) {
    if (q.sort_order === i) continue;
    const { error } = await supabase
      .from("config_questions")
      .update({ sort_order: i })
      .eq("id", q.id);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/config");
  revalidatePath("/profile");
  return {};
}
