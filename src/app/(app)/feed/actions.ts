"use server";

import { isRichHtml } from "@/lib/rich-text-lite";
import { htmlToPlainText, sanitizeRichHtml } from "@/lib/rich-text";
import { attachmentIdsFrom, linkAttachments } from "@/lib/attachments";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isSubscriber } from "@/lib/auth";
import { withinEditWindow } from "@/lib/rich-text-lite";
import type { PostIntent, PostKind, ReactionKind, ReportTarget } from "@/types/database";

const INTENTS: PostIntent[] = ["consult", "knowledge", "success"];

export type ComposerState = { error?: string };

const UPGRADE_MSG = "כתיבה בפורום נפתחת עם מנוי 💜 נשמח שתצטרפי לשיחה.";

/** Writing in the community is for subscribers (RLS enforces it too). */
async function canWrite(): Promise<boolean> {
  const profile = await getProfile();
  return !!profile && isSubscriber(profile);
}

/**
 * Fix a typo in your own words, for ten minutes after posting. Ownership is
 * enforced by RLS as well; the window is enforced here, against the row's own
 * created_at rather than anything the browser sends.
 */
/**
 * The composer sends editor HTML; legacy clients send plain text. HTML passes
 * the sanitizing allowlist, and every length rule is measured on the words —
 * markup must never eat a member's character budget.
 */
function normalizeBody(raw: string): { body: string; plain: string } {
  const trimmed = raw.trim();
  if (!isRichHtml(trimmed)) return { body: trimmed, plain: trimmed };
  const body = sanitizeRichHtml(trimmed);
  return { body, plain: htmlToPlainText(body).trim() };
}

export async function editPost(postId: string, formData: FormData): Promise<{ error?: string }> {
  const { body, plain } = normalizeBody(String(formData.get("body") ?? ""));
  if (!plain) return { error: "אי אפשר להשאיר פוסט ריק." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "תצטרכי להתחבר מחדש." };

  const { data: post } = await supabase
    .from("posts")
    .select("author_id, created_at")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.author_id !== user.id) return { error: "אפשר לערוך רק פוסט שכתבת." };
  if (!withinEditWindow(post.created_at)) {
    return { error: "חלון העריכה נסגר — אפשר לערוך עד 10 דקות אחרי הפרסום." };
  }

  const { error } = await supabase
    .from("posts")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) return { error: "לא הצלחנו לשמור כרגע. בואי ננסה שוב." };

  revalidatePath("/forum");
  revalidatePath(`/forum/${postId}`);
  return {};
}

/** The same ten-minute grace on a comment. */
export async function editComment(
  commentId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { body, plain } = normalizeBody(String(formData.get("body") ?? ""));
  if (!plain) return { error: "אי אפשר להשאיר תגובה ריקה." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "תצטרכי להתחבר מחדש." };

  const { data: comment } = await supabase
    .from("comments")
    .select("author_id, created_at, post_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment || comment.author_id !== user.id) return { error: "אפשר לערוך רק תגובה שכתבת." };
  if (!withinEditWindow(comment.created_at)) {
    return { error: "חלון העריכה נסגר — אפשר לערוך עד 10 דקות אחרי הפרסום." };
  }

  const { error } = await supabase
    .from("comments")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) return { error: "לא הצלחנו לשמור כרגע. בואי ננסה שוב." };

  revalidatePath("/forum");
  revalidatePath(`/forum/${comment.post_id}`);
  return {};
}

/** Toggle a like/save reaction on a post for the current member. */
export async function toggleReaction(postId: string, kind: ReactionKind): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await canWrite())) return;

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
  revalidatePath(`/forum/${postId}`);
}

/** Add a comment to a post. */
export async function addComment(postId: string, formData: FormData): Promise<void> {
  const { body, plain } = normalizeBody(String(formData.get("body") ?? ""));
  const attachIds = attachmentIdsFrom(formData);
  if (plain.length < 1 && attachIds.length === 0) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await canWrite())) return;
  const { data: created } = await supabase
    .from("comments")
    .insert({ post_id: postId, author_id: user.id, body })
    .select("id")
    .single();
  if (created) await linkAttachments(user.id, "comment", created.id, attachIds);
  revalidatePath("/forum");
  revalidatePath(`/forum/${postId}`);
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
  const { body, plain } = normalizeBody(String(formData.get("body") ?? ""));
  const intentRaw = String(formData.get("intent") ?? "knowledge");
  const intent: PostIntent = INTENTS.includes(intentRaw as PostIntent)
    ? (intentRaw as PostIntent)
    : "knowledge";
  const kind: PostKind = String(formData.get("kind") ?? "feed") === "forum" ? "forum" : "feed";

  const attachIds = attachmentIdsFrom(formData);
  if (plain.length < 2 && attachIds.length === 0) return { error: "כתבי משהו קצר לפני ששולחים 🙂" };
  if (plain.length > 5000) return { error: "הפוסט ארוך מדי — עד 5,000 תווים. אפשר לפצל לכמה פוסטים 💜" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await canWrite())) return { error: UPGRADE_MSG };

  const { data: createdPost, error } = await supabase
    .from("posts")
    .insert({ author_id: user.id, body, intent, kind })
    .select("id")
    .single();

  if (error) {
    return { error: "לא הצלחנו לפרסם כרגע. בואי ננסה שוב." };
  }
  if (createdPost) await linkAttachments(user.id, "post", createdPost.id, attachIds);

  revalidatePath(kind === "forum" ? "/forum" : "/feed");
  return {};
}
