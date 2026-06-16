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
