"use server";

import { redirect } from "next/navigation";
import { authenticate, endPortalSession, startPortalSession } from "@/lib/portal/auth";

export type PortalAuthState = { error?: string };

export async function portalLogin(
  _prev: PortalAuthState,
  formData: FormData
): Promise<PortalAuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "יש למלא שם משתמש וסיסמה." };
  }

  const client = await authenticate(username, password);

  // A single message for both an unknown username and a wrong password — the
  // form must not double as a way to discover which companies have access.
  if (!client) {
    return { error: "שם המשתמש או הסיסמה שגויים." };
  }

  await startPortalSession(client.id);
  redirect("/portal");
}

export async function portalLogout(): Promise<void> {
  await endPortalSession();
  redirect("/portal/login");
}
