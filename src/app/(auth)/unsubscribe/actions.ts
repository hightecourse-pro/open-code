"use server";

import { leaveCommunityFor, profileIdByEmail, stopEmailsFor } from "@/lib/departures";
import { sendResendEmail } from "@/lib/email/resend";
import { leaveConfirmEmail } from "@/lib/email/templates";
import { looksLikeEmail, normalizeEmail, unsubscribeUrl, verifyUnsubscribeToken } from "@/lib/unsubscribe";

export interface UnsubscribeState {
  ok?: boolean;
  /** What happened: mails stopped / she left / a confirmation mail went out. */
  done?: "emails" | "left" | "mail_sent";
  error?: string;
}

/**
 * The public page's one form. With a valid signed token (she came from a
 * mail) both choices apply at once; with a typed address, stopping mails
 * applies (harmless) and leaving sends a confirmation mail with a signed link.
 */
export async function unsubscribeAction(_prev: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const token = String(formData.get("token") ?? "");
  const choice = String(formData.get("choice") ?? "emails") === "leave" ? "leave" : "emails";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  if (!looksLikeEmail(email)) return { error: "כתבי כתובת מייל תקינה." };
  if (choice === "leave" && !reason) return { error: "ספרי לנו במילה או שתיים למה - זה עוזר לנו להשתפר." };
  const verified = verifyUnsubscribeToken(email, token);

  if (choice === "emails") {
    await stopEmailsFor(email, reason);
    return { ok: true, done: "emails" };
  }
  if (verified) {
    const left = await leaveCommunityFor(reason, { email });
    // an address we do not know gets the same quiet answer - nothing to reveal
    if (!left) await stopEmailsFor(email, reason);
    return { ok: true, done: "left" };
  }
  // typed address, irreversible choice: confirm through the inbox
  if (await profileIdByEmail(email)) {
    const mail = leaveConfirmEmail(unsubscribeUrl(email, { leave: true }), reason);
    await sendResendEmail({ to: email, subject: mail.subject, html: mail.html, essential: true });
  }
  return { ok: true, done: "mail_sent" };
}
