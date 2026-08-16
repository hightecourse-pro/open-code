import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback. Exchanges the `?code=` for a session (sets the cookie) and
 * forwards to `?next`. Used by social sign-in (e.g. Google).
 *
 * Email links no longer point here — they go to /auth/confirm, which works
 * across browsers — but this route stays: the code exchange needs a verifier
 * cookie from the browser that started the flow, and older auth emails already
 * in a member's inbox still land here.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  // Only same-origin paths — a `next` from an email must not bounce her off-site.
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/forum";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // A recovery link is the one failure worth naming on /login — she needs to
  // know to ask for a new one rather than retry the same mail.
  const reason = next.startsWith("/reset-password") ? "&type=recovery" : "";
  return NextResponse.redirect(`${origin}/login?error=auth${reason}`);
}
