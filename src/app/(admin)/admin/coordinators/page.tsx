import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ContactsManager, type AdminContact } from "./contacts-manager";

export const metadata: Metadata = { title: "רכזות מוסדות" };
export const dynamic = "force-dynamic";

/**
 * רכזות מוסדות (the owner, 14/9): the contact people of every study
 * institution — reachable by email from here — and the keys to their private
 * portal (/coordinator, OTP login). A contact may serve several institutions.
 */
export default async function AdminCoordinatorsPage() {
  await requireRole("admin");
  const admin = createAdminClient();

  const [{ data: contacts }, { data: links }, { data: reviews }, { data: emails }, { data: placeQ }] =
    await Promise.all([
      admin
        .from("institution_contacts")
        .select("id, full_name, email, phone, created_at")
        .order("full_name"),
      admin.from("institution_contact_links").select("contact_id, institution"),
      admin.from("coordinator_reviews").select("contact_id"),
      admin
        .from("contact_emails")
        .select("id, contact_id, subject, body, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      admin.from("config_questions").select("options").eq("key", "study_place").maybeSingle(),
    ]);

  const reviewCount = new Map<string, number>();
  for (const r of reviews ?? []) reviewCount.set(r.contact_id, (reviewCount.get(r.contact_id) ?? 0) + 1);

  const rows: AdminContact[] = (contacts ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    email: c.email,
    phone: c.phone,
    institutions: (links ?? []).filter((l) => l.contact_id === c.id).map((l) => l.institution),
    reviewCount: reviewCount.get(c.id) ?? 0,
    emails: (emails ?? [])
      .filter((e) => e.contact_id === c.id)
      .map((e) => ({ id: e.id, subject: e.subject, body: e.body, created_at: e.created_at })),
  }));

  const institutionOptions = ((placeQ?.options as { value: string; label: string }[] | null) ?? []).filter(
    (o) => o.value !== "other"
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;רכזות/&gt;</span>
        <h1 className="font-display text-[26px] font-black text-ink-1000 mt-1">רכזות מוסדות 🎓</h1>
        <p className="t-body-sm text-ink-700">
          אנשי הקשר של מוסדות הלימוד. לכל רכזת אזור אישי ב-
          <span dir="ltr" className="font-mono text-[13px]">/coordinator</span> — כניסה עם קוד חד-פעמי
          למייל. רכזת יכולה להיות מקושרת לכמה מוסדות, ומה שהיא כותבת שם גלוי רק לה ולנו.
        </p>
      </div>

      <ContactsManager contacts={rows} institutionOptions={institutionOptions} />
    </div>
  );
}
