"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "האימייל או הסיסמה לא נכונים. בואי ננסה שוב." };
  }
  redirect("/feed");
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
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: "לא הצלחנו להירשם עם הפרטים האלה. אולי כבר יש לך חשבון?" };
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
  if (!email) return { error: "כתבי כתובת אימייל." };

  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/auth/callback?next=/reset-password`,
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
    return { error: 'הקישור פג תוקף או לא תקין. בקשי קישור חדש מ"שכחתי סיסמה".' };
  }
  redirect("/feed");
}
