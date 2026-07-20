// CV download for the employer portal.
//
// The file itself lives in the private "cvs" bucket, so nothing here streams
// bytes: we resolve which document this client is entitled to, mint a
// short-lived signed URL and hand the browser a redirect.
//
// PRIVACY: the only thing this route ever exposes is a CV she chose to upload,
// and only for a member who is listed in the portal. No profile data is read
// beyond the listing gate.

import { NextResponse, type NextRequest } from "next/server";
import { getPortalClient } from "@/lib/portal/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Matches the signed-URL lifetime used elsewhere in the app. */
const SIGNED_URL_TTL = 3600;

/** Signed URLs are per-request secrets — never let a cache hold on to one. */
function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const client = await getPortalClient();
  if (!client) {
    return noStore(NextResponse.redirect(new URL("/portal/login", request.url)));
  }

  const { id } = await ctx.params;
  const admin = createAdminClient();

  // The listing gate, mirroring loadCandidates() exactly (portal_listed is
  // nullable pre-migration and null counts as listed). Kept as a narrow query
  // rather than loadCandidates() because this route only needs a yes/no and
  // must not pull every member's answers to redirect one file.
  const { data: candidate } = await admin
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("status", "active")
    .eq("profile_completed", true)
    .eq("role", "junior")
    .not("portal_listed", "is", false)
    .maybeSingle();

  if (!candidate) {
    return noStore(NextResponse.redirect(new URL("/portal", request.url)));
  }

  const profileUrl = new URL(`/portal/candidate/${id}`, request.url);
  const filePath = await resolveCvPath(admin, id, client.id);

  if (!filePath) {
    profileUrl.searchParams.set("cv", "none");
    return noStore(NextResponse.redirect(profileUrl));
  }

  const { data: signed } = await admin.storage
    .from("cvs")
    .createSignedUrl(filePath, SIGNED_URL_TTL);

  if (!signed?.signedUrl) {
    // The row points at a file the bucket no longer has.
    profileUrl.searchParams.set("cv", "error");
    return noStore(NextResponse.redirect(profileUrl));
  }

  return noStore(NextResponse.redirect(signed.signedUrl));
}

/**
 * Which CV this client gets, in order of how well it fits them:
 *   1. The CV she attached when applying to one of *this* client's jobs —
 *      she tailored it for them, so it beats anything generic.
 *   2. Her main CV, Hebrew first, newest first.
 */
async function resolveCvPath(
  admin: ReturnType<typeof createAdminClient>,
  candidateId: string,
  clientId: string
): Promise<string | null> {
  const tailored = await tailoredCvPath(admin, candidateId, clientId);
  if (tailored) return tailored;

  const { data: docs } = await admin
    .from("cv_documents")
    .select("file_path, language, created_at")
    .eq("profile_id", candidateId)
    .order("created_at", { ascending: false });

  if (!docs?.length) return null;

  // Hebrew is the default reading language for our clients; the list is
  // already newest-first, so the first Hebrew row is the newest Hebrew CV.
  const preferred = docs.find((d) => d.language === "he") ?? docs[0];
  return preferred.file_path;
}

async function tailoredCvPath(
  admin: ReturnType<typeof createAdminClient>,
  candidateId: string,
  clientId: string
): Promise<string | null> {
  const { data: jobs } = await admin.from("jobs").select("id").eq("client_id", clientId);
  if (!jobs?.length) return null;

  const { data: application } = await admin
    .from("applications")
    .select("cv_document_id, submitted_at")
    .eq("applicant_id", candidateId)
    .in("job_id", jobs.map((j) => j.id))
    .not("cv_document_id", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!application?.cv_document_id) return null;

  // Re-check ownership: an application row must never be a way to reach a
  // document that belongs to someone else.
  const { data: doc } = await admin
    .from("cv_documents")
    .select("file_path")
    .eq("id", application.cv_document_id)
    .eq("profile_id", candidateId)
    .maybeSingle();

  return doc?.file_path ?? null;
}
