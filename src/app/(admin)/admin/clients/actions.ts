"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePassword, hashPassword } from "@/lib/portal/auth";

/**
 * `password` travels back to the admin exactly once. The DB only ever holds a
 * scrypt hash, so there is no second chance to show it — the UI has to make
 * that clear at the moment it appears.
 */
export type ClientFormState = {
  error?: string;
  created?: { company: string; username: string; password: string };
};

export type PasswordResult = { error?: string; password?: string };

/**
 * Clients type this into a login box, so it has to survive being read out over
 * the phone: lowercase, no spaces, ASCII only. Hebrew input normalises away to
 * nothing, which the caller reports as a validation error rather than saving.
 */
function normaliseUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");
}

export async function createPortalClient(
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  await requireRole("admin");

  const companyName = String(formData.get("company_name") ?? "").trim();
  const username = normaliseUsername(String(formData.get("username") ?? ""));
  const contactName = String(formData.get("contact_name") ?? "").trim() || null;
  const contactEmail = String(formData.get("contact_email") ?? "").trim() || null;

  if (!companyName) return { error: "שם החברה הוא שדה חובה." };
  if (!username) return { error: "שם המשתמש צריך להכיל אותיות באנגלית או ספרות." };
  if (username.length < 3) return { error: "שם המשתמש קצר מדי — לפחות 3 תווים." };

  const admin = createAdminClient();

  // Checked up front so the admin gets a clear message instead of a raw
  // unique-constraint error; the constraint is still the real guard.
  const { data: taken } = await admin
    .from("portal_clients")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (taken) return { error: `שם המשתמש "${username}" כבר תפוס.` };

  const password = generatePassword();
  const { hash, salt } = hashPassword(password);

  const { error } = await admin.from("portal_clients").insert({
    company_name: companyName,
    username,
    password_hash: hash,
    password_salt: salt,
    contact_name: contactName,
    contact_email: contactEmail,
  });
  if (error) return { error: "לא הצלחנו ליצור את הלקוח. ייתכן ששם המשתמש כבר קיים." };

  revalidatePath("/admin/clients");
  return { created: { company: companyName, username, password } };
}

/** Issue a new password. The old one stops working immediately. */
export async function regeneratePortalPassword(id: string): Promise<PasswordResult> {
  await requireRole("admin");

  const password = generatePassword();
  const { hash, salt } = hashPassword(password);

  const { error } = await createAdminClient()
    .from("portal_clients")
    .update({ password_hash: hash, password_salt: salt })
    .eq("id", id);
  if (error) return { error: "איפוס הסיסמה נכשל. נסי שוב." };

  revalidatePath("/admin/clients");
  return { password };
}

/** Suspend or restore access. getPortalClient() re-checks this on every request. */
export async function setPortalClientActive(id: string, isActive: boolean): Promise<void> {
  await requireRole("admin");
  await createAdminClient().from("portal_clients").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin/clients");
}

/** Remove a client. Linked jobs survive — the FK detaches them (on delete set null). */
export async function deletePortalClient(id: string): Promise<void> {
  await requireRole("admin");
  await createAdminClient().from("portal_clients").delete().eq("id", id);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/jobs");
}
