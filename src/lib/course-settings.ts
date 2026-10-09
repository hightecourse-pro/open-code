import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { coursePaymentAmountOverride } from "./course-links";
import type { Json } from "@/types/database";

/**
 * Course settings the admin changes from /admin/course-registrations - today
 * only the test amount (the owner, 9/10: "תעביר ל-1 ש״ח בינתיים את ה-1,500 -
 * קונפיגורציה בדף של הקורסים במערכת"). Kept in app_settings under one key.
 */
export interface CourseSettings {
  /** Shekels to put on Shufra's payment page instead of the real price; null = real prices. */
  amountOverride: number | null;
}

const KEY = "course_settings";

export async function getCourseSettings(): Promise<CourseSettings> {
  try {
    const { data } = await createAdminClient().from("app_settings").select("value").eq("key", KEY).maybeSingle();
    const v = (data?.value ?? {}) as { amount_override?: unknown };
    const n = typeof v.amount_override === "number" ? v.amount_override : parseInt(String(v.amount_override ?? ""), 10);
    return { amountOverride: Number.isFinite(n) && n > 0 ? n : null };
  } catch {
    return { amountOverride: null };
  }
}

/** The admin's setting first, then the env (COURSE_PAYMENT_AMOUNT_OVERRIDE). */
export async function effectiveAmountOverride(): Promise<number | null> {
  return (await getCourseSettings()).amountOverride ?? coursePaymentAmountOverride();
}

export async function saveCourseSettings(patch: Partial<CourseSettings>): Promise<void> {
  const next = { ...(await getCourseSettings()), ...patch };
  const { error } = await createAdminClient()
    .from("app_settings")
    .upsert({ key: KEY, value: { amount_override: next.amountOverride } as unknown as Json }, { onConflict: "key" });
  if (error) throw error;
}
