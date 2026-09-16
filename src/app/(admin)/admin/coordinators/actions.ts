"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { contactPersonalEmail } from "@/lib/email/templates";
import { sendResendEmail } from "@/lib/email/resend";
import { startCoordinatorSession } from "@/lib/coordinators";

export type ContactFormState = { error?: string; ok?: boolean };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Create or update a contact person, replacing her institution set. */
export async function saveContact(
  _prev: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  await requireRole("admin");

  const id = String(formData.get("id") ?? "").trim() || null;
  const full_name = String(formData.get("full_name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200) || null;
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40) || null;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
  const institutions = formData.getAll("institutions").map(String).filter(Boolean);
  // Which of her institutions' reviews she manages (checkbox per institution).
  const manages = new Set(formData.getAll("manages").map(String));

  if (!full_name) return { error: "כתבי את שם הרכזת." };
  // Email optional (16/9) — without one she simply cannot log in yet.
  if (email && !EMAIL_RE.test(email)) return { error: "כתובת המייל לא נראית תקינה." };
  if (institutions.length === 0) return { error: "בחרי לפחות מוסד אחד." };

  const admin = createAdminClient();
  let contactId = id;
  if (id) {
    const { error } = await admin
      .from("institution_contacts")
      .update({ full_name, email, phone, notes, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error)
      return { error: error.code === "23505" ? "כבר קיימת רכזת עם המייל הזה." : "השמירה נכשלה. נסי שוב." };
  } else {
    const { data, error } = await admin
      .from("institution_contacts")
      .insert({ full_name, email, phone, notes })
      .select("id")
      .single();
    if (error || !data)
      return { error: error?.code === "23505" ? "כבר קיימת רכזת עם המייל הזה." : "השמירה נכשלה. נסי שוב." };
    contactId = data.id;
  }

  // The institution set is small — replacing it whole keeps add/remove one code path.
  await admin.from("institution_contact_links").delete().eq("contact_id", contactId!);
  const { error: linkError } = await admin
    .from("institution_contact_links")
    .insert(
      institutions.map((institution) => ({
        contact_id: contactId!,
        institution,
        manages_reviews: manages.has(institution),
      }))
    );
  if (linkError) return { error: "הרכזת נשמרה אבל קישור המוסדות נכשל — פתחי אותה לעריכה ונסי שוב." };

  revalidatePath("/admin/coordinators");
  return { ok: true };
}

/** The owner's per-coordinator portal switch (16/9). */
export async function setContactPortalEnabled(id: string, enabled: boolean): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  await admin
    .from("institution_contacts")
    .update({ portal_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/coordinators");
}

/** Remove a contact — her links, reviews and email log go with her (cascade). */
export async function deleteContact(id: string): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("institution_contacts").delete().eq("id", id);
  revalidatePath("/admin/coordinators");
}

/**
 * See the portal exactly as one coordinator sees it (the owner, 15/9):
 * admin-only — opens a real coordinator session for that contact plus a
 * display marker so the portal shows the "תצוגת ניהול" strip. Anything done
 * there (a saved review) is done in her name.
 */
export async function viewAsCoordinator(contactId: string): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("institution_contacts")
    .select("id")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return;
  await startCoordinatorSession(contactId);
  const jar = await cookies();
  jar.set("oc_coord_admin", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/coordinator",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/coordinator");
}

export type ContactEmailState = { error?: string; ok?: boolean };

/** A personal email from the team to one contact, logged on her card. */
export async function sendContactEmail(
  _prev: ContactEmailState,
  formData: FormData
): Promise<ContactEmailState> {
  await requireRole("admin");

  const contactId = String(formData.get("contact_id") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 200);
  const body = String(formData.get("body") ?? "").trim().slice(0, 8000);
  if (!contactId) return { error: "לא נמצאה הרכזת." };
  if (!body) return { error: "כתבי את תוכן ההודעה." };

  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("institution_contacts")
    .select("id, full_name, email")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return { error: "לא נמצאה הרכזת." };
  if (!contact.email) return { error: "לרכזת הזו אין כתובת מייל — השלימי אותה קודם." };

  const firstName = contact.full_name.split(" ")[0];
  const mail = contactPersonalEmail(firstName, body, subject || undefined);
  const sent = await sendResendEmail({ to: contact.email, subject: mail.subject, html: mail.html });
  if (!sent.ok) {
    return {
      error:
        sent.error === "blocked_by_allowlist"
          ? "בסביבת הבדיקות מיילים נשלחים רק לכתובות מאושרות — ההודעה לא נשלחה."
          : "השליחה נכשלה. נסי שוב בעוד רגע.",
    };
  }

  await admin
    .from("contact_emails")
    .insert({ contact_id: contactId, subject: subject || null, body });

  revalidatePath("/admin/coordinators");
  return { ok: true };
}

export type CoordChatState = { error?: string; ok?: boolean };

/**
 * A team reply into a coordinator's thread — signed with the replying team
 * member's name (the owner, 16/9: "תהיה חתימה לתשובה של מי מהצוות ענתה").
 */
export async function replyToCoordinator(
  contactId: string,
  _prev: CoordChatState,
  formData: FormData
): Promise<CoordChatState> {
  const me = await requireRole("admin");
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  if (!body) return { error: "כתבי תשובה קודם 🙂" };

  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("institution_contacts")
    .select("id")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return { error: "הרכזת לא נמצאה." };

  const { error } = await admin.from("coordinator_messages").insert({
    contact_id: contactId,
    sender: "team",
    body,
    team_author_name: me.full_name,
  });
  if (error) return { error: "התשובה לא נשלחה — נסי שוב." };
  revalidatePath("/admin/coordinators");
  return { ok: true };
}

/** Opening a thread marks the coordinator's messages as read. */
export async function markThreadRead(contactId: string): Promise<void> {
  await requireRole("admin");
  const { markCoordinatorMessagesRead } = await import("@/lib/coordinator-data");
  await markCoordinatorMessagesRead(contactId, "team");
  revalidatePath("/admin/coordinators");
}

/**
 * A specific question to the coordinator about a candidate, from the review
 * center (the owner, 16/9) — reaches her BOTH by email and in the chat,
 * signed by the asking team member.
 */
export async function askCoordinatorQuestion(
  contactId: string,
  candidateName: string,
  question: string
): Promise<{ error?: string }> {
  const me = await requireRole("admin");
  const clean = question.trim().slice(0, 2000);
  if (!clean) return { error: "כתבי שאלה קודם 🙂" };

  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("institution_contacts")
    .select("id, full_name, email")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return { error: "הרכזת לא נמצאה." };

  const body = `שאלה על ${candidateName}:\n${clean}`;
  const { error } = await admin.from("coordinator_messages").insert({
    contact_id: contactId,
    sender: "team",
    body,
    team_author_name: me.full_name,
  });
  if (error) return { error: "השליחה נכשלה — נסי שוב." };

  // Email too (best effort — the chat copy is already there).
  if (contact.email) {
    const mail = contactPersonalEmail(
      contact.full_name.split(" ")[0],
      `${body}\n\nאפשר לענות לנו כאן במייל או בצ'אט באזור האישי שלך.`,
      `שאלה מקוד פתוח על ${candidateName}`
    );
    await sendResendEmail({ to: contact.email, subject: mail.subject, html: mail.html });
  }
  revalidatePath("/admin/coordinators");
  return {};
}
