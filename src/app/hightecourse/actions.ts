"use server";

import { revalidateTag } from "next/cache";
import { getProfile, hasHcAccess } from "@/lib/auth";
import { HC_CACHE_TAG } from "./data";
import { resendCourseUpdate, resendPrepMail, runPrepTick, sendCourseUpdateSamples, sendPrepSamples, setCourseUpdateEnabled, setPrepEnabled, type TickResult } from "@/lib/hc-preconf/data";

/** ״רענון מהגיליון״ - drops the cached reads so the next render reads the sheet again. Anyone the system lets in. */
export async function refreshHcAction(): Promise<{ ok: boolean }> {
  const profile = await getProfile();
  if (!hasHcAccess(profile)) return { ok: false };
  revalidateTag(HC_CACHE_TAG, "max");
  return { ok: true };
}

/* ---- the pre-conference mail (the owner, 19/11) - for everyone the system lets in (22/11: ״תפתח לה כל מה שקשור להייטקורס״) ---- */

async function mayManage(): Promise<boolean> {
  const profile = await getProfile().catch(() => null);
  return hasHcAccess(profile);
}

/** ״להריץ עכשיו״: the sheet in, the mails out (with the switch on and `send`), the mirror tab. */
export async function hcPrepRunAction(send: boolean): Promise<TickResult> {
  if (!(await mayManage())) return { ok: false, at: new Date().toISOString(), trigger: "admin", error: "forbidden" };
  return runPrepTick({ send: !!send, trigger: send ? "admin" : "admin-dry" });
}

/** The owner's switch - nothing goes out while it is off. */
export async function hcPrepToggleAction(enabled: boolean): Promise<{ ok: boolean }> {
  if (!(await mayManage())) return { ok: false };
  await setPrepEnabled(!!enabled);
  return { ok: true };
}

/** The six variations to one address (hers), as real sample rows so the links in them work. */
export async function hcPrepSamplesAction(to: string): Promise<{ ok: boolean; error?: string; results: { n: number; label: string; ok: boolean; error?: string }[] }> {
  if (!(await mayManage())) return { ok: false, error: "forbidden", results: [] };
  const addr = (to ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return { ok: false, error: "כתובת לא תקינה", results: [] };
  const results = await sendPrepSamples(addr);
  return { ok: results.every((r) => r.ok), results };
}

/** One participant again. */
export async function hcPrepResendAction(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await mayManage())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "bad_id" };
  return resendPrepMail(id);
}

/* ---- the per-course update mail (the owner, 22/11: ״נתחיל קורס קורס… תשלח לי דוגמא וכשאאשר תשלח לכל הקבוצה״) ---- */

/** The course's switch: on = the tick mails everyone in the course who has not got it, now and later. */
export async function hcCourseUpdateToggleAction(course: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!(await mayManage())) return { ok: false, error: "forbidden" };
  if (typeof course !== "string" || !course.trim()) return { ok: false, error: "bad_course" };
  return setCourseUpdateEnabled(course.trim(), !!enabled);
}

/** The course's three variations to one address (hers). */
export async function hcCourseUpdateSamplesAction(to: string, course: string): Promise<{ ok: boolean; error?: string; results: { n: string; label: string; ok: boolean; error?: string }[] }> {
  if (!(await mayManage())) return { ok: false, error: "forbidden", results: [] };
  const addr = (to ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return { ok: false, error: "כתובת לא תקינה", results: [] };
  if (typeof course !== "string" || !course.trim()) return { ok: false, error: "bad_course", results: [] };
  const results = await sendCourseUpdateSamples(addr, course.trim());
  return { ok: results.every((r) => r.ok), results };
}

/** One participant's update mail again. */
export async function hcCourseUpdateResendAction(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await mayManage())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "bad_id" };
  return resendCourseUpdate(id);
}
