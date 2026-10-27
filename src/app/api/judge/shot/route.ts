import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { judgeAccessFor } from "@/lib/judging";

export const dynamic = "force-dynamic";

/**
 * The automated report's screenshot, on demand (26/10 night): the judging
 * pages no longer carry sixty JPEG data URIs - the owner's /judge weighed
 * ~4MB and took nine seconds - only a flag; the image itself comes from here.
 * The owner's view (an admin who is not an appointed judge) - and, since 27/10,
 * a judge the owner opened the review to, for her own challenges only.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id, role, status").eq("id", user.id).maybeSingle();
  if (!profile) return new NextResponse(null, { status: 403 });
  const access = await judgeAccessFor(profile);
  if (!access.judge || !access.autoReport) return new NextResponse(null, { status: 403 });
  const team = new URL(req.url).searchParams.get("team") ?? "";
  if (!team) return new NextResponse(null, { status: 400 });
  // A judge the owner opened the review to: her own challenges, like her desk.
  if (access.restricted) {
    const { data: sub } = await admin.from("hackathon_submissions").select("challenge_key").eq("team_key", team).maybeSingle();
    if (!sub || !access.challengeKeys.includes(sub.challenge_key)) return new NextResponse(null, { status: 403 });
  }
  const { data } = await admin.from("hackathon_auto_reports").select("report").eq("team_key", team).maybeSingle();
  const first = (data?.report as { screenshots?: unknown } | null)?.screenshots;
  const shot = Array.isArray(first) ? first[0] : null;
  const m = typeof shot === "string" ? shot.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/) : null;
  if (!m) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(m[2].replace(/\s/g, ""), "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=3600" },
  });
}
