"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { attachCoursePayment } from "./actions";

export interface UnmatchedPayment {
  id: string;
  transaction_id: string;
  amount_agorot: number | null;
  installments: number | null;
  client_name: string | null;
  email: string | null;
  phone: string | null;
  groupe: string | null;
  comments: string | null;
  created_at: string;
}

export interface RegistrationOption {
  id: string;
  full_name: string;
  email: string;
  reg_code: string | null;
  status: string;
}

const fmt = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
const nis = (agorot: number | null) => new Intl.NumberFormat("he-IL").format((agorot ?? 0) / 100);

/**
 * Payments Shufra's callback recognised as the course (group / amount) but
 * could not hang on a registration - no code in the comment, unknown email.
 * The admin picks the registration; the system then does everything the
 * automatic match would have done (paid ✓, alert, mails).
 */
export function UnmatchedPayments({ payments: initial, registrations }: { payments: UnmatchedPayment[]; registrations: RegistrationOption[] }) {
  const router = useRouter();
  const [payments, setPayments] = useState(initial);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (payments.length === 0) return null;

  function attach(p: UnmatchedPayment) {
    const regId = choice[p.id];
    if (!regId) return setError("בחרי קודם את ההרשמה שהתשלום שייך לה.");
    setError(null);
    start(async () => {
      const r = await attachCoursePayment(p.id, regId);
      if (r.error) return setError(r.error);
      setPayments((prev) => prev.filter((x) => x.id !== p.id));
      router.refresh();
    });
  }

  return (
    <section className="rounded-[16px] border border-amber-200 bg-amber-50/60 px-4 py-3 flex flex-col gap-2">
      <h2 className="font-display font-bold text-[16px] text-ink-1000">תשלומים לשיוך ({payments.length})</h2>
      <p className="text-[12.5px] text-ink-600 leading-relaxed">
        הגיעו מנדרים של שופרא ונראים כמו תשלום לקורס, אבל בלי קוד הרשמה בהערה ובלי מייל שמופיע ברשימה. בחרי למי כל תשלום שייך -
        ההרשמה תסומן ״שולם ✓״ ויישלחו המיילים לשופרא ולנרשמת.
      </p>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="overflow-x-auto rounded-[12px] border border-amber-200 bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-amber-50 text-ink-600 text-[12px]">
            <tr>
              <th className="text-start px-3 py-2 font-semibold">מי שילמה (לפי נדרים)</th>
              <th className="text-start px-3 py-2 font-semibold">סכום</th>
              <th className="text-start px-3 py-2 font-semibold">פרטי התשלום</th>
              <th className="text-start px-3 py-2 font-semibold">שיוך להרשמה</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-amber-100 align-top">
                <td className="px-3 py-2">
                  <div className="font-semibold text-ink-1000">{p.client_name ?? "ללא שם"}</div>
                  <div dir="ltr" className="text-start text-ink-600">
                    {p.email}
                  </div>
                  <div dir="ltr" className="text-start text-ink-500">
                    {p.phone}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap font-semibold text-ink-1000">
                  {nis(p.amount_agorot)} ₪
                  {p.installments && p.installments > 1 && <div className="text-[11.5px] font-normal text-ink-500">ב-{p.installments} תשלומים</div>}
                </td>
                <td className="px-3 py-2 text-ink-600">
                  <div>{fmt.format(new Date(p.created_at))}</div>
                  {p.groupe && <div className="text-[11.5px]">קבוצה: {p.groupe}</div>}
                  {p.comments && <div className="text-[11.5px] max-w-[260px] truncate" title={p.comments}>הערה: {p.comments}</div>}
                  <div dir="ltr" className="text-start text-[11px] text-ink-400">
                    {p.transaction_id}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`שיוך תשלום ${p.transaction_id}`}
                      value={choice[p.id] ?? ""}
                      disabled={pending}
                      onChange={(e) => setChoice((c) => ({ ...c, [p.id]: e.target.value }))}
                      className="rounded-[10px] border border-ink-200 px-2 py-1.5 text-[12.5px] max-w-[260px] focus:border-brand-purple outline-none"
                    >
                      <option value="">בחרי הרשמה…</option>
                      {registrations.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.full_name} · {r.email}
                          {r.reg_code ? ` · ${r.reg_code}` : ""}
                          {r.status === "paid" ? " (כבר שולם)" : ""}
                        </option>
                      ))}
                    </select>
                    <Button type="button" size="sm" disabled={pending} onClick={() => attach(p)}>
                      שיוך
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
