import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHALLENGES } from "@/app/hackathon-2026/shared";
import { loadMaterials, registrableChallenges } from "@/lib/hackathon";
import { RegistrationsTable, type RegistrationRow } from "./registrations-table";
import { MaterialsManager } from "./materials-manager";

export const metadata: Metadata = { title: "האקתון" };
export const dynamic = "force-dynamic";

/**
 * ניהול ההאקתון (the owner, 5/10): who registered to which challenge (and
 * with whom), counts per challenge, and each challenge's downloadable
 * materials.
 */
export default async function AdminHackathonPage() {
  await requireRole("admin");
  const admin = createAdminClient();
  const [{ data: regs }, materials] = await Promise.all([
    admin
      .from("hackathon_registrations")
      .select("profile_id, challenge_key, partner_profile_id, partner_confirmed_at, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5000),
    loadMaterials(),
  ]);
  const ids = [...new Set((regs ?? []).flatMap((r) => [r.profile_id, r.partner_profile_id].filter((x): x is string => !!x)))];
  const nameOf = new Map<string, { name: string; status: string }>();
  if (ids.length) {
    const { inChunks } = await import("@/lib/chunk");
    const profs = await inChunks<{ id: string; full_name: string; status: string }>(ids, (chunk) =>
      admin.from("profiles").select("id, full_name, status").in("id", chunk)
    );
    for (const p of profs) nameOf.set(p.id, { name: p.full_name, status: p.status });
  }
  const rows: RegistrationRow[] = (regs ?? []).map((r) => ({
    profileId: r.profile_id,
    name: nameOf.get(r.profile_id)?.name ?? r.profile_id,
    status: nameOf.get(r.profile_id)?.status ?? "",
    challengeKey: r.challenge_key,
    challenge: CHALLENGES.find((c) => c.key === r.challenge_key)?.short ?? r.challenge_key,
    partnerId: r.partner_profile_id,
    partnerName: r.partner_profile_id ? (nameOf.get(r.partner_profile_id)?.name ?? null) : null,
    partnerConfirmed: !!r.partner_confirmed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  const challenges = registrableChallenges().map((c) => ({ key: c.key!, short: c.short, org: c.org }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display font-bold text-[24px] text-ink-1000">האקתון AI 2026</h1>
        <p className="text-[13.5px] text-ink-600 mt-1">
          מי רשומה לאיזה אתגר (לבד או כזוג), וחומרי האתגרים להורדה למנויות. ההרשמה והחומרים נמצאים בקהילה תחת ״האקתון״.
        </p>
      </div>
      <RegistrationsTable rows={rows} challenges={challenges} />
      <MaterialsManager challenges={challenges} materials={materials} />
    </div>
  );
}
