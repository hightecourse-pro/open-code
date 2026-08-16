import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Email-link verification via token_hash (Supabase templates:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 * Unlike the `?code=` flow, this works even when the link is opened in a
 * different browser than the one that started the flow.
 */

const OTP_TYPES: readonly string[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function asOtpType(value: string | null): EmailOtpType | null {
  return value && OTP_TYPES.includes(value) ? (value as EmailOtpType) : null;
}

/** Only same-origin paths — an emailed `next` must never bounce her off-site. */
function safeNext(raw: string | null, type: EmailOtpType | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return type === "recovery" ? "/reset-password" : "/forum";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = asOtpType(searchParams.get("type"));
  const next = safeNext(searchParams.get("next"), type);

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Tell /login which link failed: a spent signup token usually means she is
  // already confirmed, while a dead recovery token needs a fresh request.
  const reason = type ? `&type=${type}` : "";
  return NextResponse.redirect(`${origin}/login?error=auth${reason}`);
}
