"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PostIntent, PostKind, ReactionKind, ReportTarget } from "@/types/database";

const INTENTS: PostIntent[] = ["consult", "knowledge", "success"];

export type ComposerState = { error?: string };

/** Toggle a like/save reaction on a post for the current member. */
export async function toggleReaction(postId: string, kind: ReactionKind): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("profile_id", user.id)
    .eq("kind", kind)
    .maybeSingle();

  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
  } else {
    await supabase.from("reactions").insert({ post_id: postId, profile_id: user.id, kind });
  }
  revalidatePath("/forum");
}

/** Add a comment to a post. */
export async function addComment(postId: string, formData: FormData): Promise<void> {
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 1) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("comments").insert({ post_id: postId, author_id: user.id, body });
  revalidatePath("/forum");
}

/** Report a post or comment for moderation. */
export async function reportContent(
  targetType: ReportTarget,
  targetId: string,
  reason: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("reports").insert({
    target_type: targetType,
    target_id: targetId,
    reporter_id: user.id,
    reason: reason.trim() || null,
  });
}

export async function createPost(
  _prev: ComposerState,
  formData: FormData
): Promise<ComposerState> {
  const body = String(formData.get("body") ?? "").trim();
  const intentRaw = String(formData.get("intent") ?? "knowledge");
  const intent: PostIntent = INTENTS.includes(intentRaw as PostIntent)
    ? (intentRaw as PostIntent)
    : "knowledge";
  const kind: PostKind = String(formData.get("kind") ?? "feed") === "forum" ? "forum" : "feed";

  if (body.length < 2) return { error: "כתבי משהו קצר לפני ששולחים 🙂" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("posts").insert({ author_id: user.id, body, intent, kind });

  if (error) {
    return { error: "לא הצלחנו לפרסם כרגע. בואי ננסה שוב." };
  }

  revalidatePath(kind === "forum" ? "/forum" : "/feed");
  return {};
}
