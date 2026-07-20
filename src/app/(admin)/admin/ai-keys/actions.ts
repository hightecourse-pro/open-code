"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { addSystemKey, deleteSystemKey, reviveSystemKey } from "@/lib/ai/system-keys";

export type AddSystemKeyState = { ok?: boolean; error?: string };

export async function addSystemKeyAction(
  _prev: AddSystemKeyState,
  formData: FormData
): Promise<AddSystemKeyState> {
  await requireRole("admin");

  const key = String(formData.get("key") ?? "");
  const label = String(formData.get("label") ?? "");
  if (!key.trim()) return { error: "צריך להדביק מפתח." };

  const { error } = await addSystemKey(key, label);
  if (error) return { error };

  revalidatePath("/admin/ai-keys");
  return { ok: true };
}

/** Put an exhausted/invalid key back in rotation — quotas reset daily. */
export async function reviveSystemKeyAction(id: string): Promise<void> {
  await requireRole("admin");
  await reviveSystemKey(id);
  revalidatePath("/admin/ai-keys");
}

export async function deleteSystemKeyAction(id: string): Promise<void> {
  await requireRole("admin");
  await deleteSystemKey(id);
  revalidatePath("/admin/ai-keys");
}
