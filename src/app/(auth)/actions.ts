"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";

export type AuthState = { error?: string; message?: string };

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "האימייל או הסיסמה לא נכונים. בואי ננסה שוב." };
  }
  redirect("/forum");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (fullName.length < 2) return { error: "נשמח לדעת איך קוראים לך 🙂" };
  if (password.length < 8) return { error: "הסיסמה צריכה להיות באורך 8 תווים לפחות." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // The confirmation link must land back on the app (never localhost) and
      // go through the code-exchange callback so a session is established.
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/forum`,
    },
  });

  if (error) {
    // Surface the real reason (server logs) — the message shown to the member
    // is friendly, but we keep the cause for diagnosis.
    console.error("[signup] failed", { code: error.code, status: error.status, message: error.message });
    const code = error.code ?? "";
    const msg = (error.message ?? "").toLowerCase();

    if (code === "user_already_exists") {
      return { error: "כבר קיים חשבון עם האימייל הזה. אפשר להיכנס או לאפס סיסמה." };
    }
    if (code === "weak_password") {
      return { error: "הסיסמה חלשה מדי — נסי סיסמה ארוכה יותר עם אותיות ומספרים." };
    }
    if (code === "email_address_invalid") {
      return { error: "כתובת האימייל לא נראית תקינה. בדקי אותה שוב 🙂" };
    }
    if (error.status === 429 || code === "over_email_send_rate_limit") {
      return { error: "יותר מדי ניסיונות בזמן קצר. נסי שוב בעוד כמה דקות." };
    }
    if (msg.includes("confirmation email") || msg.includes("sending") || error.status === 500) {
      return { error: "יש תקלה זמנית בשליחת מייל האימות מהצד שלנו. אנחנו כבר מטפלות — נסי שוב עוד רגע 🙏" };
    }
    return { error: "לא הצלחנו להשלים את ההרשמה כרגע. נסי שוב עוד רגע." };
  }

  // Anti-enumeration: Supabase returns a fake success for an already-registered
  // email, with an empty identities array. Treat that as "you already have one".
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { error: "כבר קיים חשבון עם האימייל הזה. אפשר להיכנס או לאפס סיסמה." };
  }

  // Email confirmation off → we have a session; on → ask her to confirm.
  if (data.session) {
    redirect("/join");
  }
  return {
    message: "שלחנו לך מייל לאישור הכתובת. אשרי אותו ונמשיך משם 💌",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Step 1: send the reset link to the member's email. */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "כתבי את כתובת האימייל שלך ונשלח קישור." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  });

  // Don't reveal whether the address exists.
  return { message: "אם הכתובת רשומה אצלנו, שלחנו אליה קישור לאיפוס סיסמה 💌" };
}

/** Step 2: set the new password (runs inside the recovery session from the link). */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "הסיסמה צריכה להיות לפחות 8 תווים." };
  if (password !== confirm) return { error: "הסיסמאות לא תואמות." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: 'הקישור פג תוקף או לא תקין. בקשי קישור חדש דרך "שכחת סיסמה?".' };
  }
  redirect("/forum");
}
