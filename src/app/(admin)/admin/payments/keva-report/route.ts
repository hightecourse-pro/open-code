// דוח הוראות הקבע — שורה אחת לכל חברה (the owner, 14/9: "שלא יהיה בו כפולים
// ויהיה נח לשימוש"). A member's kevas are merged into her one row: a replaced
// card used to produce two rows, and a first charge captured without a keva
// id produced a third. Charges are counted by distinct charge DAYS — the
// import recorded some charges twice (keva-N + bare transaction id).
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

interface MemberRow {
  key: string; // profile id, or "ext:<email>" for unmatched externals
  profileId: string | null;
  name: string;
  email: string;
  phone: string;
  kevas: Set<string>;
  nedarimCreated: string; // earliest CreatedDate from the imported list
  chargeDays: Set<string>;
  firstSeen: Date | null;
  lastSeen: Date | null;
  amountAgorot: number | null;
}

const SUB_STATUS_HE: Record<string, string> = {
  active: "פעיל",
  trialing: "ניסיון",
  past_due: "תשלום כושל",
  canceled: "בוטל",
};

const MEMBER_STATUS_HE: Record<string, string> = {
  active: "פעילה",
  pending: "ממתינה",
  paused: "מושהית",
  rejected: "נדחתה",
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

  const members = new Map<string, MemberRow>();
  const rowFor = (key: string): MemberRow => {
    let r = members.get(key);
    if (!r) {
      r = {
        key, profileId: key.startsWith("ext:") ? null : key,
        name: "", email: "", phone: "", kevas: new Set(),
        nedarimCreated: "", chargeDays: new Set(),
        firstSeen: null, lastSeen: null, amountAgorot: null,
      };
      members.set(key, r);
    }
    return r;
  };
  const kevaOf = (raw: Record<string, string>, providerId: string | null | undefined) =>
    raw.KevaId || /keva-(\d+)$/.exec(providerId ?? "")?.[1] || null;

  // The imported Nedarim list — authoritative keva start dates + contact info.
  for (const ep of externals ?? []) {
    const email = (ep.email ?? "").toLowerCase();
    const pid = ep.claimed_by ?? emailToId.get(email) ?? null;
    const r = rowFor(pid ?? `ext:${email || ep.provider_payment_id}`);
    const raw = (ep.raw ?? {}) as Record<string, string>;
    r.name = r.name || ep.client_name || "";
    r.email = r.email || ep.email || "";
    r.phone = r.phone || ep.phone || "";
    r.amountAgorot = r.amountAgorot ?? ep.amount_agorot;
    const kid = kevaOf(raw, ep.provider_payment_id);
    if (kid) r.kevas.add(kid);
    const created = raw.CreatedDate ?? "";
    if (created && (!r.nedarimCreated || created < r.nedarimCreated)) r.nedarimCreated = created;
  }

  // Charges the system captured — merged into the member's row.
  for (const p of pays ?? []) {
    const raw = (p.raw ?? {}) as Record<string, string>;
    const r = rowFor(p.profile_id);
    const kid = kevaOf(raw, p.provider_payment_id);
    if (kid) r.kevas.add(kid);
    const at = new Date(p.paid_at as string);
    r.chargeDays.add(at.toISOString().slice(0, 10));
    if (!r.firstSeen || at < r.firstSeen) r.firstSeen = at;
    if (!r.lastSeen || at > r.lastSeen) r.lastSeen = at;
    r.amountAgorot = r.amountAgorot ?? p.amount_agorot;
    if (!r.name && raw.ClientName) r.name = raw.ClientName;
    if (!r.email && raw.Mail) r.email = raw.Mail;
    if (!r.phone && raw.Phone) r.phone = raw.Phone;
  }

  // Member + subscription context.
  const profileIds = [...members.values()].map((r) => r.profileId).filter((x): x is string => !!x);
  const { data: profs } = profileIds.length
    ? await admin.from("profiles").select("id, full_name, status, member_tier").in("id", profileIds)
    : { data: [] };
  const profOf = new Map((profs ?? []).map((p) => [p.id, p]));
  const subOf = new Map((subs ?? []).map((s) => [s.profile_id, s]));

  const rows = [...members.values()].sort((a, b) => {
    const an = a.profileId ? (profOf.get(a.profileId)?.full_name ?? a.name) : a.name;
    const bn = b.profileId ? (profOf.get(b.profileId)?.full_name ?? b.name) : b.name;
    return (an || "ת").localeCompare(bn || "ת", "he");
  });

  const header = [
    "שם", "מייל", "טלפון", "מזהי קבע", "תחילת הקבע (נדרים)",
    "חיוב ראשון שנקלט", "חיוב אחרון שנקלט", "חיובים שנקלטו",
    "משולם עד", "חידוש", "סטטוס חברה", "סכום ₪",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    const prof = r.profileId ? profOf.get(r.profileId) : null;
    const sub = r.profileId ? subOf.get(r.profileId) : null;
    const renewal =
      !sub ? "—"
      : sub.status !== "active" && sub.status !== "trialing" ? (SUB_STATUS_HE[sub.status] ?? sub.status)
      : sub.canceled_at ? "כבוי — לא יתחדש"
      : "מתחדש";
    lines.push(
      [
        prof?.full_name || r.name || "—",
        r.email,
        r.phone,
        [...r.kevas].join(" · ") || "—",
        r.nedarimCreated || "—",
        r.firstSeen ? IL_DATE.format(r.firstSeen) : "—",
        r.lastSeen ? IL_DATE.format(r.lastSeen) : "—",
        r.chargeDays.size,
        sub?.current_period_end ? IL_DATE.format(new Date(sub.current_period_end)) : (prof ? "אין רשומת מנוי" : "לא רשומה לאתר"),
        renewal,
        prof ? (MEMBER_STATUS_HE[prof.status] ?? prof.status) : "לא רשומה",
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
