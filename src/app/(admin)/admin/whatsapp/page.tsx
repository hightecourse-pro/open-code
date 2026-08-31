import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWaConfig, getWaVerifyToken, toWaId, waWindowLeftMs } from "@/lib/whatsapp";
import { AutoRefresh } from "@/components/patterns/auto-refresh";
import { WaInbox, type WaContactRow, type WaMessageRow } from "./wa-inbox";

export const metadata: Metadata = { title: "וואטסאפ" };

/**
 * The WhatsApp inbox (the owner, 31/8): the community number runs on Meta's
 * Cloud API — no phone, no app — and the team answers from here. Until the
 * owner completes the Meta signup, the screen shows exactly what is still
 * missing instead of a dead inbox.
 */
export default async function AdminWhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  await requireRole("admin");
  const { c: activeId } = await searchParams;
  const admin = createAdminClient();

  const configured = getWaConfig() !== null;
  const webhookReady = !!getWaVerifyToken();

  const { data: contacts } = await admin
    .from("wa_contacts")
    .select("id, wa_id, display_name, profile_id, last_message_at, last_inbound_at")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(500);

  // A contact whose number matches a member's profile phone gets her name.
  const memberNameOf = new Map<string, string>();
  if (contacts?.length) {
    const { data: phoneQ } = await admin
      .from("config_questions")
      .select("id")
      .eq("key", "phone")
      .maybeSingle();
    if (phoneQ) {
      const { data: phones } = await admin
        .from("profile_answers")
        .select("profile_id, value")
        .eq("question_id", phoneQ.id)
        .limit(5000);
      const byWa = new Map<string, string>();
      for (const p of phones ?? []) {
        if (typeof p.value !== "string") continue;
        const wa = toWaId(p.value);
        if (wa) byWa.set(wa, p.profile_id);
      }
      const matchedIds = [
        ...new Set(contacts.map((ct) => byWa.get(ct.wa_id)).filter((x): x is string => !!x)),
      ];
      if (matchedIds.length) {
        const { data: profs } = await admin
          .from("profiles")
          .select("id, full_name")
          .in("id", matchedIds);
        const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
        for (const ct of contacts) {
          const pid = byWa.get(ct.wa_id);
          const nm = pid ? nameById.get(pid) : null;
          if (nm) memberNameOf.set(ct.id, nm);
        }
      }
    }
  }

  const active = (contacts ?? []).find((ct) => ct.id === activeId) ?? null;
  const { data: messages } = active
    ? await admin
        .from("wa_messages")
        .select("id, direction, body, status, error, created_at")
        .eq("contact_id", active.id)
        .order("created_at", { ascending: true })
        .limit(500)
    : { data: [] };

  const rows: WaContactRow[] = (contacts ?? []).map((ct) => ({
    id: ct.id,
    waId: ct.wa_id,
    name: memberNameOf.get(ct.id) ?? ct.display_name ?? `+${ct.wa_id}`,
    isMember: memberNameOf.has(ct.id),
    lastMessageAt: ct.last_message_at,
    windowLeftMs: waWindowLeftMs(ct.last_inbound_at),
  }));

  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh seconds={20} />
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;וואטסאפ/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">וואטסאפ</h1>
        <p className="t-body-sm text-ink-500">
          ההתכתבות של מספר הקהילה — נכנסות ותשובות, בלי טלפון ובלי אפליקציה.
        </p>
      </div>

      {!configured && (
        <div className="bg-tint-warm border border-[#F8D98C] rounded-[16px] p-4 text-[13.5px] text-ink-900 leading-relaxed">
          <b>החיבור למטא עוד לא הושלם.</b> מה שחסר כדי שההודעות יזרמו:
          <ul className="list-disc ps-5 mt-1.5 flex flex-col gap-1">
            <li>חשבון Meta Business + אפליקציה עם מוצר WhatsApp (מדריך צעד-צעד אצל המפתח).</li>
            <li>רישום המספר 02-5800296 ואימות בשיחה קולית לקו הבזק.</li>
            <li>
              שלושה מפתחות בהגדרות השרת: <code className="font-mono text-[12px]">WHATSAPP_TOKEN</code>,{" "}
              <code className="font-mono text-[12px]">WHATSAPP_PHONE_NUMBER_ID</code>,{" "}
              <code className="font-mono text-[12px]">WHATSAPP_APP_SECRET</code>
              {webhookReady ? " (סוד ה-webhook כבר מוגדר ✓)" : ""}.
            </li>
          </ul>
          המסך כבר מוכן — ברגע שהמפתחות ייכנסו, הכל יעבוד מיד.
        </div>
      )}

      <WaInbox contacts={rows} activeId={active?.id ?? null} messages={(messages ?? []) as WaMessageRow[]} canSend={configured} />
    </div>
  );
}
