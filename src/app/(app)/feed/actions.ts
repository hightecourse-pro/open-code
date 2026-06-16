"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PostIntent, PostKind } from "@/types/database";

const INTENTS: PostIntent[] = ["consult", "knowledge", "success"];

export type ComposerState = { error?: string };

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
