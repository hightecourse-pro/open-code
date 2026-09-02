"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { attachmentIdsFrom, linkAttachments } from "@/lib/attachments";
import { fireTaskTrigger } from "@/lib/admin/tasks";

/**
 * The floating "יש לך בקשה?" widget: a message straight to the team. The row
 * feeds the admin's requests screen, and the alerts center pings her — the
 * reply comes back to the member in chat.
 */
export async function createMemberRequest(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const subject = String(formData.get("subject") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  if (!subject || !body) return { error: "כתבי נושא וכמה מילים — כדי שנדע איך לעזור 🙂" };

  const { data: created, error } = await supabase
    .from("member_requests")
    .insert({ profile_id: user.id, subject, body })
    .select("id")
    .single();
  if (error || !created) return { error: "משהו השתבש — נסי שוב עוד רגע." };
  // Screenshots pasted/attached in the widget (the owner, 2/9).
  await linkAttachments(user.id, "request", created.id, attachmentIdsFrom(formData));
  await fireTaskTrigger("new_request", { title: `פניה חדשה: ${subject}`, link: "/admin/requests" });

  // No alerts-center row (the owner, 2026-08-30): a member request lives ONLY
  // in פניות לצוות — the sidebar badge there is what says "something waits".

  return {};
}
