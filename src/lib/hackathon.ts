import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHALLENGES, type Challenge } from "@/app/hackathon-2026/shared";
import type { MaterialRow } from "@/lib/hackathon-shared";
export { formatBytes, type MaterialRow } from "@/lib/hackathon-shared";

/** Challenges a member can actually register to (revealed, with details). */
export function registrableChallenges(): Challenge[] {
  return CHALLENGES.filter((c) => !!c.key && !!c.challenge);
}

export function challengeByKey(key: string): Challenge | null {
  return CHALLENGES.find((c) => c.key === key) ?? null;
}

export interface RegistrationView {
  challengeKey: string;
  partner: { id: string; name: string } | null;
  /** False while the invited partner has not confirmed yet. */
  partnerConfirmed: boolean;
  updatedAt: string;
}

/** Her own registration, with the partner's name resolved. */
export async function loadMyRegistration(profileId: string): Promise<RegistrationView | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hackathon_registrations")
    .select("challenge_key, partner_profile_id, partner_confirmed_at, updated_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data) return null;
  let partner: RegistrationView["partner"] = null;
  if (data.partner_profile_id) {
    const { data: p } = await admin.from("profiles").select("id, full_name").eq("id", data.partner_profile_id).maybeSingle();
    if (p) partner = { id: p.id, name: p.full_name };
  }
  return { challengeKey: data.challenge_key, partner, partnerConfirmed: !!data.partner_confirmed_at, updatedAt: data.updated_at };
}

export interface PairInvite {
  inviterId: string;
  inviterName: string;
  challengeKey: string;
  challengeShort: string;
  since: string;
}

/** Invitations waiting for HER answer: rows naming her as partner, unconfirmed. */
export async function loadPendingInvites(profileId: string): Promise<PairInvite[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hackathon_registrations")
    .select("profile_id, challenge_key, updated_at")
    .eq("partner_profile_id", profileId)
    .is("partner_confirmed_at", null);
  if (!data?.length) return [];
  const { data: names } = await admin.from("profiles").select("id, full_name").in("id", data.map((r) => r.profile_id));
  const nameOf = new Map((names ?? []).map((p) => [p.id, p.full_name]));
  return data.map((r) => ({
    inviterId: r.profile_id,
    inviterName: nameOf.get(r.profile_id) ?? "חברה",
    challengeKey: r.challenge_key,
    challengeShort: challengeByKey(r.challenge_key)?.short ?? r.challenge_key,
    since: r.updated_at,
  }));
}

/** Subscribers she can pair with (active paid juniors, not herself). */
export async function loadPairCandidates(profileId: string): Promise<{ id: string; name: string }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("status", "active")
    .eq("member_tier", "paid")
    .eq("role", "junior")
    .neq("id", profileId)
    .eq("is_hidden", false)
    .order("full_name")
    .limit(2000);
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name }));
}

export async function loadMaterials(challengeKey?: string): Promise<MaterialRow[]> {
  const admin = createAdminClient();
  let q = admin.from("hackathon_materials").select("id, challenge_key, title, file_path, size_bytes, created_at").order("created_at");
  if (challengeKey) q = q.eq("challenge_key", challengeKey);
  const { data } = await q;
  return (data ?? []) as MaterialRow[];
}
