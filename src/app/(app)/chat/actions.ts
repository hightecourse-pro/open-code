"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/resend";
import { newMessageEmail } from "@/lib/email/templates";

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

  // A junior may only message an active mentor — block once a mentor is removed.
  const { data: conv } = await supabase
    .from("conversations")
    .select("a_id, b_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return;
  const otherId = conv.a_id === user.id ? conv.b_id : conv.a_id;
  const [{ data: me }, { data: other }] = await Promise.all([
    supabase.from("profiles").select("role, first_name, full_name").eq("id", user.id).single(),
    supabase.from("profiles").select("role, status").eq("id", otherId).single(),
  ]);
  const otherIsActiveMentor = other?.role === "mentor" && other?.status === "active";
  if (me?.role === "junior" && !otherIsActiveMentor) return;

  // Notify the mentor by email — but only on the first new (unread) message from
  // this member, so a burst of messages doesn't send a burst of emails.
  const notifyMentor = me?.role === "junior" && otherIsActiveMentor;
  let isFirstNew = false;
  if (notifyMentor) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("sender_id", user.id)
      .is("read_at", null);
    isFirstNew = (count ?? 0) === 0;
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body,
  });
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (notifyMentor && isFirstNew) {
    try {
      const admin = createAdminClient();
      const { data: mentorUser } = await admin.auth.admin.getUserById(otherId);
      const email = mentorUser?.user?.email;
      if (email) {
        const fromName = me?.first_name || me?.full_name?.split(" ")[0] || "חברה";
        const built = newMessageEmail(fromName);
        await sendResendEmail({ to: email, subject: built.subject, html: built.html });
      }
    } catch {
      // Email is best-effort — never block sending the message.
    }
  }

  revalidatePath("/chat");
}
