import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { raiseAlert } from "@/lib/alerts";
import { nedarimCallbackIps } from "@/lib/payments/nedarim";
import { courseCallbackSecret, courseForwardUrl, courseMosadId } from "@/lib/course-registration";
import { recordCoursePayment } from "@/lib/course-payment";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";
// Processing + passing the update on to Shufra's own hook.
export const maxDuration = 30;

/**
 * Shufra's Nedarim CallBack for the course (the owner, 9/10).
 *
 * Configured on SHUFRA's account (mosad 7009686), not ours, so it is a
 * separate door from /api/webhooks/payments: it never activates a membership,
 * it only records course payments. The URL the owner pastes into their Nedarim
 * admin carries a shared secret (?key=...) - that is the authentication; a
 * call from one of Nedarim's known servers is accepted as well.
 *
 * Their account reports EVERY payment Shufra takes. The separation lives in
 * recordCoursePayment: registration code in the comment → email → the saved
 * page's group / a course amount → otherwise ignored.
 *
 * Nedarim allows one URL per event, and Shufra already had one there (a
 * Google Apps Script). Every authenticated update is therefore passed on to
 * COURSE_CALLBACK_FORWARD_URL (declines: COURSE_CALLBACK_FORWARD_URL_DECLINES)
 * with the same body and content type, after we are done with it.
 */

const FORWARDED_HEADER = "x-course-forwarded";

function constantEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function callerIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
}

/** Best-effort diagnostic: the last call, the last rejection, the last ignored one. */
async function logEvent(key: string, value: Record<string, unknown>) {
  try {
    await createAdminClient().from("app_settings").upsert({ key, value: value as unknown as Json }, { onConflict: "key" });
  } catch (e) {
    console.log("[webhook/course-payments] diagnostic write failed", String(e));
  }
}

/** Pass the update on to Shufra's own hook, unchanged. Never throws; the outcome lands in the record. */
async function forward(
  req: Request,
  raw: string,
  contentType: string,
  params: Record<string, string>,
  record: Record<string, unknown>
) {
  // A call that is itself a forward never fans out again.
  if (req.headers.get(FORWARDED_HEADER)) return;
  const isDecline = params.Status === "Error" && !!params.Message;
  const url = courseForwardUrl(isDecline ? "declines" : "transactions");
  if (!url) return;
  const body = raw || JSON.stringify(params);
  const type = raw ? contentType || "application/json" : "application/json";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": type, [FORWARDED_HEADER]: "1" },
      body,
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    record.forward = { status: res.status, ok: res.ok };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    record.forward = { ...(record.forward as object | undefined), error: String(e) };
    await raiseAlert({
      kind: "course_forward_failed",
      severity: "warning",
      title: `עדכון מנדרים של שופרא לא הועבר הלאה למערכת שלהן: ${params.ClientName ?? params.TransactionId ?? ""}`.trim(),
      body: `אצלנו העדכון נקלט, אבל ההעברה לכתובת שהיתה מוגדרת אצל שופרא לפני שלנו נכשלה (${String(e).slice(0, 120)}). הנתונים שמורים בהתראה הזו - אפשר לשלוח אותם ידנית או לבקש מנדרים לשלוח שוב.`,
      context: { url, params, contentType: type },
      dedupeKey: `course-forward:${params.TransactionId ?? params.ID ?? params.ErrorTime ?? Date.now()}`,
    });
  }
}

async function handleCallback(req: Request) {
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const contentType = req.headers.get("content-type") ?? "";
  let raw = "";
  try {
    raw = req.method === "GET" ? "" : await req.text();
    if (raw) {
      if (contentType.includes("application/json")) {
        Object.assign(params, JSON.parse(raw));
      } else {
        for (const [k, v] of new URLSearchParams(raw).entries()) params[k] = v;
      }
    }
  } catch {
    /* unreadable body - the query string may still carry the call */
  }

  const providedKey = params.key ?? req.headers.get("x-callback-key") ?? "";
  delete params.key;
  const ip = callerIp(req);
  const record: Record<string, unknown> = { at: new Date().toISOString(), method: req.method, ip, params };

  const secret = courseCallbackSecret();
  const secretOk = !!secret && !!providedKey && constantEquals(providedKey, secret);
  const fromNedarim = nedarimCallbackIps().includes(ip);
  const mosad = (params.MosadNumber ?? params.Mosad ?? "").trim();

  if (!secretOk && !fromNedarim) {
    // Scanner noise earns a quiet 401; a call that names Shufra's mosad but
    // cannot authenticate is worth a look (the URL in their admin lost its key?).
    if (!providedKey && !mosad) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    record.outcome = providedKey ? "bad_secret" : "unauthenticated_caller";
    await logEvent("last_course_webhook_rejected", record);
    if (mosad === courseMosadId()) {
      await raiseAlert({
        kind: "course_webhook_rejected",
        severity: "warning",
        title: "דיווח תשלום לקורס נדחה - לא אומת",
        body: "הגיע דיווח עם מספר המוסד של שופרא אבל בלי המפתח הסודי (או ממקור שהמערכת לא מזהה כנדרים). לבדוק שכתובת ה-CallBack בנדרים של שופרא היא בדיוק זו שמופיעה במסך הנרשמות, ולהצליב את התשלום מול דוח נדרים.",
        context: record,
        dedupeKey: `course-webhook:${record.outcome}:${ip}`,
      });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  record.authedBy = secretOk ? "secret" : "ip";

  // Only Shufra's mosad. A refusal report may arrive bare (no mosad) - let it
  // through to the matcher, which documents it only for a known registrant.
  const isFailure = params.Status === "Error" && !!params.Message;
  if (mosad !== courseMosadId() && !(isFailure && !mosad)) {
    record.outcome = "unrecognized_mosad";
    await logEvent("last_course_webhook_rejected", record);
    return NextResponse.json({ error: "unrecognized mosad" }, { status: 401 });
  }

  try {
    const r = await recordCoursePayment(params);
    Object.assign(record, { outcome: r.outcome, registrationId: r.registrationId ?? null, transactionId: r.transactionId ?? null, matchedBy: r.matchedBy ?? null });
  } catch (e) {
    record.outcome = "error";
    record.error = String(e);
    console.error("[webhook/course-payments]", String(e));
    await raiseAlert({
      kind: "course_payment_error",
      severity: "critical",
      title: "דיווח תשלום לקורס לא נשמר",
      body: `הדיווח מנדרים של שופרא הגיע אבל השמירה נכשלה. להצליב מול דוח נדרים. ${params.ClientName ?? ""} ${params.Amount ? `· ${params.Amount} ₪` : ""}`.trim(),
      context: record,
      dedupeKey: `course-error:${params.TransactionId ?? params.ID ?? ip}`,
    });
  }
  // Shufra's own hook hears everything we heard - ours or not.
  await forward(req, raw, contentType, params, record);
  const key =
    record.outcome === "error" ? "last_course_webhook_rejected"
    : record.outcome === "ignored_unrelated" || record.outcome === "failure_ignored" ? "last_course_webhook_ignored"
    : "last_course_webhook";
  await logEvent(key, record);
  if (record.outcome === "error") return NextResponse.json({ error: "failed" }, { status: 500 });
  return NextResponse.json({ ok: true, outcome: record.outcome });
}

// Nedarim does not commit to a method - both run the same path.
export { handleCallback as GET, handleCallback as POST };
