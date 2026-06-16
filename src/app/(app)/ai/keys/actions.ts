"use server";

import { revalidatePath } from "next/cache";
import { addUserKey, deleteUserKey } from "@/lib/ai/keys";

export type AddKeyState = { ok?: boolean; error?: string };

export async function addKeyAction(_prev: AddKeyState, formData: FormData): Promise<AddKeyState> {
  const key = String(formData.get("key") ?? "");
  const label = String(formData.get("label") ?? "");
  const res = await addUserKey(key, label);
  if (!res.ok) return { error: res.error };
  revalidatePath("/ai/keys");
  return { ok: true };
}

export async function removeKey(id: string): Promise<void> {
  await deleteUserKey(id);
  revalidatePath("/ai/keys");
}
