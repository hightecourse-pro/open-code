"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { raiseAlert } from "@/lib/alerts";

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

  const { error } = await supabase
    .from("member_requests")
    .insert({ profile_id: user.id, subject, body });
  if (error) return { error: "משהו השתבש — נסי שוב עוד רגע." };

  const { data: who } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  await raiseAlert({
    kind: "member_request",
    severity: "info",
    title: `בקשה חדשה מ${who?.full_name ?? "חברה"}: ${subject}`,
    body: body.slice(0, 300),
    context: { profileId: user.id },
    dedupeKey: `member-request:${user.id}:${subject}`,
  });

  return {};
}
