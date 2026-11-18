"use server";

import { revalidateTag } from "next/cache";
import { getProfile } from "@/lib/auth";
import { HC_CACHE_TAG } from "./data";

/** ״רענון מהגיליון״ - drops the cached reads so the next render reads the sheet again. Admins only. */
export async function refreshHcAction(): Promise<{ ok: boolean }> {
  const profile = await getProfile();
  if (profile?.role !== "admin") return { ok: false };
  revalidateTag(HC_CACHE_TAG, "max");
  return { ok: true };
}
