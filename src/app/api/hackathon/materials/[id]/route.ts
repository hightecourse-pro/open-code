import { NextResponse } from "next/server";
import { getProfile, isSubscriber } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Download a challenge's material - subscribers (and the team) only. The file
 * sits in the private "attachments" bucket; a short signed link does the rest.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const profile = await getProfile();
  if (!profile) return NextResponse.redirect(new URL("/login?next=/hackathon", process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.opencode.org.il"));
  if (!isSubscriber(profile)) {
    return NextResponse.redirect(new URL("/join?locked=hackathon", process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.opencode.org.il"));
  }
  const admin = createAdminClient();
  const { data: m } = await admin.from("hackathon_materials").select("file_path, title").eq("id", id).maybeSingle();
  if (!m) return new NextResponse("not found", { status: 404 });
  const { data: signed, error } = await admin.storage.from("hackathon").createSignedUrl(m.file_path, 60 * 60, {
    download: m.title,
  });
  if (error || !signed?.signedUrl) return new NextResponse("unavailable", { status: 503 });
  return NextResponse.redirect(signed.signedUrl);
}
