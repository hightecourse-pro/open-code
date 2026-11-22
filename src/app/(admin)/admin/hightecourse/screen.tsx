import { createAdminClient } from "@/lib/supabase/admin";
import { conferenceNotifyEmail, conferenceSheetId, sheetUrlOf, type OrderRow, type ParticipantRow } from "@/lib/conference";
import { CONFERENCE_KEY, DAY, PATHS, PRICE, nis } from "@/lib/conference-shared";
import { getSiteUrl } from "@/lib/site";
import { OrdersTable, type AdminOrder } from "./orders-table";

/**
 * הייטקורס - רישום לכנס (the owner, 17/11: ״תשמור את הנתונים גם ב-DB ותן לי
 * לראות באזור האדמין וגם בשיטס״): every order from the public page, its
 * participants, where the payment stands, whether the Google Sheet got the
 * rows, and a note. One screen behind two doors: /admin/hightecourse (the Open
 * Code admin) and /hightecourse/day3 (מערכת ניהול הייטקורס - the owner, 22/11:
 * ״תפתח לה כל מה שקשור להייטקורס״). The caller gates; the actions gate again.
 */
export async function ConferenceOrdersScreen() {
  const admin = createAdminClient();
  const { data: orderRows } = await admin.from("conference_orders").select("*").eq("event_key", CONFERENCE_KEY).order("created_at", { ascending: false }).limit(1000);
  const orders = (orderRows ?? []) as OrderRow[];
  const ids = orders.map((o) => o.id);
  const { data: partRows } = ids.length ? await admin.from("conference_participants").select("*").in("order_id", ids).order("seq", { ascending: true }) : { data: [] };
  const byOrder = new Map<string, ParticipantRow[]>();
  for (const p of (partRows ?? []) as ParticipantRow[]) byOrder.set(p.order_id, [...(byOrder.get(p.order_id) ?? []), p]);
  const rows: AdminOrder[] = orders.map((o) => ({ ...o, participants: byOrder.get(o.id) ?? [] }));

  const live = rows.filter((r) => r.status !== "canceled");
  const paid = live.filter((r) => r.status === "paid");
  const summary = {
    orders: live.length,
    participants: live.reduce((n, r) => n + r.participant_count, 0),
    paidParticipants: paid.reduce((n, r) => n + r.participant_count, 0),
    paidNis: paid.reduce((n, r) => n + r.amount_nis, 0),
    openNis: live.filter((r) => r.status !== "paid").reduce((n, r) => n + r.amount_nis, 0),
    awaitingTransfer: live.filter((r) => r.status === "awaiting_transfer").length,
    toVerify: live.filter((r) => r.status === "paid_reported").length,
    sheetErrors: rows.filter((r) => !r.sheet_synced_at && r.status !== "pending" && r.status !== "canceled").length,
  };
  const sheetId = conferenceSheetId();
  const site = getSiteUrl();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-bold text-[24px] text-ink-1000">הייטקורס 2026 - רישום ליום חמישי</h1>
        <p className="text-[13.5px] text-ink-600 mt-1 leading-relaxed">
          כל מי שנרשמה בדף הציבורי{" "}
          <a href={`${site}${PATHS.landing}`} target="_blank" rel="noreferrer" className="underline" style={{ color: "inherit" }} dir="ltr">
            {site.replace(/^https?:\/\//, "")}
            {PATHS.landing}
          </a>{" "}
          ליום השלישי ({DAY.label} {DAY.date}, {DAY.hebrew}). משתתפת יחידה {nis(PRICE.single)} ₪; קבוצה מ-{PRICE.groupMin} משתתפות {nis(PRICE.group)} ₪ למשתתפת. אשראי נסלק בנדרים שלנו והקולבק
          מסמן ״שולם ✓״; העברה בנקאית נרשמת מיד כ״ממתינה לתשלום״ - שולחים לה חשבונית למייל ומסמנות כאן ״שולם״ כשהכסף הגיע. כל הרשמה שהושלמה נכתבת גם לגיליון{" "}
          <a href={sheetUrlOf(sheetId)} target="_blank" rel="noreferrer" className="underline" style={{ color: "inherit" }}>
            רישום ליום השלישי
          </a>{" "}
          (שורה לכל משתתפת), ומייל יוצא ל-{conferenceNotifyEmail()}.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="hc-admin-summary">
        {(
          [
            ["הרשמות", String(summary.orders), `${summary.participants} משתתפות`],
            ["שולם", `${nis(summary.paidNis)} ₪`, `${summary.paidParticipants} משתתפות`],
            ["פתוח לתשלום", `${nis(summary.openNis)} ₪`, `${summary.awaitingTransfer} בהעברה · ${summary.toVerify} לאימות`],
            ["הגיליון", summary.sheetErrors ? `${summary.sheetErrors} לא נכתבו` : "מעודכן", summary.sheetErrors ? "יש כפתור ״לכתוב שוב״ בשורה" : "כל הרשמה שהושלמה כתובה"],
          ] as const
        ).map(([label, value, sub]) => (
          <div key={label} className="rounded-[14px] border border-ink-100 bg-white px-4 py-3">
            <div className="text-[12px] font-semibold text-ink-500">{label}</div>
            <div className="font-display font-bold text-[20px] text-ink-1000 mt-0.5">{value}</div>
            <div className="text-[12px] text-ink-500">{sub}</div>
          </div>
        ))}
      </div>
      <OrdersTable rows={rows} />
    </div>
  );
}
