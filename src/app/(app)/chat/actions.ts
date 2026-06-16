"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Find or create a 1:1 conversation with another member, then open it. */
export async function startConversation(otherId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (otherId === user.id) redirect("/chat");

  // Normalize the pair so (a,b) is stable regardless of who initiates.
  const [a_id, b_id] = [user.id, otherId].sort();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("a_id", a_id)
    .eq("b_id", b_id)
    .maybeSingle();

  let convId = existing?.id;
  if (!convId) {
    const { data: created } = await supabase
      .from("conversations")
      .insert({ a_id, b_id })
      .select("id")
      .single();
    convId = created?.id;
  }

  redirect(`/chat?c=${convId}`);
}

export async function sendMessage(conversationId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body,
  });
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  revalidatePath("/chat");
}
