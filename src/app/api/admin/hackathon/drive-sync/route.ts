import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { judgeAccessFor } from "@/lib/judging";
import { syncVideosToDrive, unmirrorVideo } from "@/lib/hackathon-drive";

export const dynamic = "force-dynamic";
// A 50 MB video goes storage -> here -> Drive; a few of those fit in one call.
export const maxDuration = 300;

/** The owner only - an admin who is not an appointed judge - or the cron secret (the team's tooling runs a pass). */
async function ownerOr403(req?: Request) {
  const secret = process.env.CRON_SECRET;
  if (req && secret && req.headers.get("authorization") === `Bearer ${secret}`) return { id: "cron" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await createAdminClient().from("profiles").select("id, role, status").eq("id", user.id).maybeSingle();
  if (!p || p.role !== "admin") return null;
  const access = await judgeAccessFor(p);
  return access.restricted ? null : p;
}

/** One sync pass: mirror what is missing, share with the judges. The button repeats until `remaining` is 0. */
export async function POST(req: Request) {
  if (!(await ownerOr403(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const r = await syncVideosToDrive(250_000);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "sync_failed" }, { status: 500 });
  }
}

/** Undo one team's mirror (?team=<team_key>). */
export async function DELETE(req: Request) {
  if (!(await ownerOr403(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const team = new URL(req.url).searchParams.get("team") ?? "";
  if (!team) return NextResponse.json({ error: "team" }, { status: 400 });
  try {
    await unmirrorVideo(team);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
