import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { answersOf, loadPrepAdmin, mirrorSheetUrl, MIRROR_TAB, type PrepRow } from "@/lib/hc-preconf/data";
import { CONF, KIND_LABEL, prepFormPath, resolveCourse, type PrepKind } from "@/lib/hc-preconf/config";
import { GateView, hcGate } from "../shell";
import { PrepAdmin, type PrepAdminRow } from "./prep-admin";

export const metadata: Metadata = { title: { absolute: "מייל לפני הכנס | ניהול הייטקורס" } };
export const dynamic = "force-dynamic";

/** One row as the screen lists it - the sheet's snapshot, the mail's outcome, her answers. */
function rowOf(r: PrepRow): PrepAdminRow {
  const a = answersOf(r);
  return {
    id: r.id,
    isSample: r.is_sample,
    sheetNum: r.sheet_num ?? "",
    name: `${r.first_name} ${r.last_name}`.trim(),
    email: r.email,
    cc: r.cc_email ?? "",
    company: r.company ?? "",
    course: r.course || r.course_raw,
    courseRaw: r.course_raw,
    courseNote: resolveCourse(r.course_raw).note ?? "",
    kind: r.course_kind as PrepKind,
    kindLabel: KIND_LABEL[(r.course_kind as PrepKind) ?? "unknown"] ?? r.course_kind,
    laptopRequired: r.laptop_required,
    laptopRental: r.laptop_rental ?? "",
    laptopOwn: r.laptop_own ?? "",
    lodging: r.lodging ?? "",
    updatedPersonal: r.updated_personal,
    hold: r.hold_reason ?? "",
    removed: !!r.removed_at,
    mailStatus: r.mail_status ?? "",
    mailSentAt: r.mail_sent_at,
    mailError: r.mail_error ?? "",
    answeredAt: r.answered_at,
    prefilled: !!r.prefill,
    answers: a,
    formPath: prepFormPath(r.token),
  };
}

/**
 * ״מייל לפני הכנס״ (the owner, 19/11): the frontal participants with what was
 * sent and what each one answered, the switch that lets the tick mail, the
 * run-now buttons, the samples to her own inbox, the link to the mirror tab.
 */
export default async function HcPrepPage() {
  const { profile, allowed } = await hcGate();
  if (!allowed) return <GateView profile={profile} />;
  const [{ rows, settings }, supabase] = await Promise.all([loadPrepAdmin(), createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <PrepAdmin
      rows={rows.map(rowOf)}
      enabled={settings.enabled}
      lastRunAt={settings.last_run_at}
      lastRun={settings.last_run as Record<string, unknown> | null}
      sheetUrl={mirrorSheetUrl()}
      sheetTab={MIRROR_TAB}
      defaultSampleTo={user?.email ?? ""}
      subject={CONF.subject}
    />
  );
}
