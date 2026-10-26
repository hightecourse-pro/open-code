import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordAppError } from "@/lib/error-log";

export const dynamic = "force-dynamic";

/**
 * The client error boundary's report (26/10): what crashed in the browser,
 * on which page, for which signed-in member. Stored in the error ring, read
 * on /admin/errors. Anonymous visitors are ignored, bodies are clipped.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  let body: { message?: unknown; stack?: unknown; digest?: unknown; url?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);
  await recordAppError({
    kind: "client",
    where: str(body.url, 300) ?? "?",
    message: str(body.message, 1000) ?? "(no message)",
    stack: str(body.stack, 4000),
    digest: str(body.digest, 100),
    profileId: user.id,
  });
  return NextResponse.json({ ok: true });
}
