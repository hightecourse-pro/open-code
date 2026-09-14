// דוח הוראות הקבע (the owner, 14/9: "תאפשר לי להוריד דוח של הוראות הקבע,
// מתי התחילו ומתי יסתיימו לכל אחת מהמנויות") — one CSV row per keva, with
// Nedarim's own dates (CreatedDate / NextDate from the imported list) side by
// side with what the system recorded (first/last captured charge, the
// subscription's period end). The side-by-side IS the point: start-date
// mismatches for members who paid outside the system become visible per row.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const IL_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

interface KevaRow {
  kevaId: string;
  clientName: string;
  email: string;
  phone: string;
  profileId: string | null;
  nedarimCreated: string;
  nedarimNext: string;
  firstSeen: Date | null;
  lastSeen: Date | null;
  charges: number;
  amountAgorot: number | null;
}

const SUB_STATUS_HE: Record<string, string> = {
  active: "פעיל",
  trialing: "ניסיון",
  past_due: "תשלום כושל",
  canceled: "בוטל",
};

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  await requireRole("admin");
  const admin = createAdminClient();

  const [{ data: externals }, { data: pays }, { data: subs }] = await Promise.all([
    admin.from("external_payments").select("*").eq("needs_review", false),
    admin
      .from("payments")
      .select("profile_id, provider_payment_id, amount_agorot, paid_at, raw")
      .eq("status", "succeeded"),
    admin.from("subscriptions").select("profile_id, status, current_period_end, canceled_at"),
  ]);

  // email (lowercased) → auth user id, for matching the imported list to members.
  const emailToId = new Map<string, string>();
  const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of usersPage?.users ?? []) {
    if (u.email) emailToId.set(u.email.toLowerCase(), u.id);
  }

  const kevas = new Map<string, KevaRow>();
  const rowFor = (kevaId: string): KevaRow => {
    let r = kevas.get(kevaId);
    if (!r) {
      r = {
        kevaId, clientName: "", email: "", phone: "", profileId: null,
        nedarimCreated: "", nedarimNext: "", firstSeen: null, lastSeen: null,
        charges: 0, amountAgorot: null,
      };
      kevas.set(kevaId, r);
    }
    return r;
  };

  // The imported Nedarim list — the authoritative keva start (CreatedDate)
  // and next charge (NextDate).
  for (const ep of externals ?? []) {
    const raw = (ep.raw ?? {}) as Record<string, string>;
    const kid = raw.KevaId || /keva-(\d+)$/.exec(ep.provider_payment_id ?? "")?.[1];
    if (!kid) continue;
    const r = rowFor(String(kid));
    r.clientName = ep.client_name ?? r.clientName;
    r.email = ep.email ?? r.email;
    r.phone = ep.phone ?? r.phone;
    r.nedarimCreated = raw.CreatedDate ?? "";
    r.nedarimNext = raw.NextDate ?? "";
    r.amountAgorot = ep.amount_agorot ?? r.amountAgorot;
    if (!r.profileId) {
      r.profileId = ep.claimed_by ?? emailToId.get((ep.email ?? "").toLowerCase()) ?? null;
    }
  }

  // Charges captured by the system — first/last per keva. A charge with no
  // keva id (one-time / iframe first payment) groups per member so it still
  // appears rather than vanishing.
  for (const p of pays ?? []) {
    const raw = (p.raw ?? {}) as Record<string, string>;
    const kid =
      raw.KevaId || /keva-(\d+)$/.exec(p.provider_payment_id ?? "")?.[1] || `ללא-קבע:${p.profile_id}`;
    const r = rowFor(String(kid));
    const at = new Date(p.paid_at as string);
    if (!r.firstSeen || at < r.firstSeen) r.firstSeen = at;
    if (!r.lastSeen || at > r.lastSeen) r.lastSeen = at;
    r.charges++;
    r.amountAgorot = r.amountAgorot ?? p.amount_agorot;
    r.profileId = r.profileId ?? p.profile_id;
    if (!r.clientName && raw.ClientName) r.clientName = raw.ClientName;
    if (!r.email && raw.Mail) r.email = raw.Mail;
    if (!r.phone && raw.Phone) r.phone = raw.Phone;
  }

  // Member + subscription context.
  const profileIds = [...new Set([...kevas.values()].map((r) => r.profileId).filter((x): x is string => !!x))];
  const { data: profs } = profileIds.length
    ? await admin.from("profiles").select("id, full_name, status, member_tier").in("id", profileIds)
    : { data: [] };
  const profOf = new Map((profs ?? []).map((p) => [p.id, p]));
  const subOf = new Map((subs ?? []).map((s) => [s.profile_id, s]));

  const MEMBER_STATUS_HE: Record<string, string> = {
    active: "פעילה",
    pending: "ממתינה",
    paused: "מושהית",
    rejected: "נדחתה",
  };

  const rows = [...kevas.values()].sort((a, b) =>
    (a.clientName || "ת").localeCompare(b.clientName || "ת", "he")
  );

  const header = [
    "מזהה קבע", "שם בנדרים", "חברה במערכת", "מייל", "טלפון",
    "תחילת הקבע (נדרים)", "חיוב ראשון שנקלט במערכת", "חיוב אחרון שנקלט",
    "חיובים שנקלטו", "החיוב הבא (נדרים)", "סוף התקופה במערכת",
    "סטטוס מנוי", "סטטוס חברה", "סכום ₪",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    const prof = r.profileId ? profOf.get(r.profileId) : null;
    const sub = r.profileId ? subOf.get(r.profileId) : null;
    lines.push(
      [
        r.kevaId,
        r.clientName || "—",
        prof?.full_name ?? "לא מקושרת לחשבון",
        r.email,
        r.phone,
        r.nedarimCreated || "לא ברשימת הייבוא",
        r.firstSeen ? IL_DATE.format(r.firstSeen) : "—",
        r.lastSeen ? IL_DATE.format(r.lastSeen) : "—",
        r.charges,
        r.nedarimNext || "—",
        sub?.current_period_end ? IL_DATE.format(new Date(sub.current_period_end)) : "אין רשומת מנוי",
        sub ? (SUB_STATUS_HE[sub.status] ?? sub.status) : "—",
        prof ? (MEMBER_STATUS_HE[prof.status] ?? prof.status) : "—",
        r.amountAgorot != null ? (r.amountAgorot / 100).toFixed(0) : "—",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  // BOM so Excel opens the Hebrew correctly.
  const csv = "﻿" + lines.join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''keva-report-${today}.csv`,
    },
  });
}
