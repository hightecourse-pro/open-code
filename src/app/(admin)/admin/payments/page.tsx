import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import {
  ExternalPaymentsList,
  type ExternalPaymentRow,
  type MemberOption,
} from "./external-payments-list";

export const metadata: Metadata = { title: "תשלומים חיצוניים" };
export const dynamic = "force-dynamic";

export default async function AdminExternalPaymentsPage() {
  await requireRole("admin");
  const admin = createAdminClient();

  const [{ data: payments }, { data: profiles }] = await Promise.all([
    admin
      .from("external_payments")
      .select("id, client_name, email, phone, amount_agorot, provider_payment_id, needs_review, created_at, claimed_at, claimed_by")
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["junior", "mentor"])
      .order("full_name", { ascending: true }),
  ]);

  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const rows: ExternalPaymentRow[] = (payments ?? []).map((p) => ({
    id: p.id,
    client_name: p.client_name,
    email: p.email,
    phone: p.phone,
    amount_agorot: p.amount_agorot,
    provider_payment_id: p.provider_payment_id,
    needs_review: p.needs_review === true,
    created_at: p.created_at,
    claimed_at: p.claimed_at,
    claimedName: p.claimed_by ? (nameOf.get(p.claimed_by) ?? null) : null,
  }));
  const members: MemberOption[] = (profiles ?? []).map((p) => ({
    id: p.id,
    label: p.full_name || p.id.slice(0, 8),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;תשלומים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">תשלומים חיצוניים</h1>
        <p className="t-body-sm text-ink-500">
          תשלומים שהגיעו מנדרים פלוס בלי לעבור דרך האתר — מי מחכה, ממתי, ולמי לשייך.
        </p>
      </div>

      <ExternalPaymentsList
        waiting={rows.filter((r) => !r.claimed_at)}
        claimed={rows.filter((r) => !!r.claimed_at)}
        members={members}
      />
    </div>
  );
}
