import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Email-link verification via token_hash (Supabase templates:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 * Unlike the `?code=` flow, this works even when the link is opened in a
 * different browser than the one that started the flow.
 *
 * GET renders a confirm button and does NOT consume the token; POST verifies.
 * The old GET-verifies flow meant any mailbox link-scanner that prefetched the
 * link consumed the token: signup tokens were silently confirmed without the
 * member ever clicking (the tester read that as an auth bypass), and a
 * prefetched recovery token made the member's real click land on "expired".
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

const BUTTON_LABEL: Partial<Record<EmailOtpType, string>> = {
  signup: "אישור ההרשמה שלי ✓",
  recovery: "המשך לאיפוס הסיסמה",
  magiclink: "כניסה לחשבון",
  email_change: "אישור החלפת הכתובת",
  invite: "אישור ההצטרפות",
  email: "אישור",
};

const HEADLINE: Partial<Record<EmailOtpType, string>> = {
  signup: "עוד לחיצה אחת ואת בפנים 💜",
  recovery: "איפוס הסיסמה שלך",
  magiclink: "הכניסה שלך לקהילה",
  email_change: "אישור הכתובת החדשה",
  invite: "ההזמנה שלך מחכה",
  email: "אישור הכתובת",
};

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = asOtpType(searchParams.get("type"));
  const next = safeNext(searchParams.get("next"), type);

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>קהילת קוד פתוח</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#F4EDFB; font-family:"Segoe UI","Arial Hebrew",Arial,sans-serif; color:#1A1420; }
  .card { background:#fff; border:1px solid #E7E0EC; border-radius:22px; padding:40px 36px;
          max-width:400px; width:calc(100% - 48px); text-align:center;
          box-shadow:0 8px 30px rgba(26,20,32,.08); }
  .bar { height:4px; border-radius:4px; background:linear-gradient(135deg,#E0418D,#6B3D99);
         margin:0 auto 22px; width:64px; }
  h1 { font-size:22px; margin:0 0 8px; font-weight:800; }
  p { color:#574C60; font-size:14.5px; line-height:1.6; margin:0 0 24px; }
  button { display:inline-block; border:0; cursor:pointer; color:#fff; font-weight:700; font-size:15px;
           padding:12px 30px; border-radius:12px; background:linear-gradient(135deg,#E0418D,#6B3D99); }
  button:hover { filter:brightness(1.06); }
</style>
</head>
<body>
  <main class="card">
    <div class="bar"></div>
    <h1>${HEADLINE[type] ?? "אישור"}</h1>
    <p>קהילת קוד פתוח — פותחים לך דלת להייטק</p>
    <form method="post" action="/auth/confirm">
      <input type="hidden" name="token_hash" value="${esc(token_hash)}" />
      <input type="hidden" name="type" value="${esc(type)}" />
      <input type="hidden" name="next" value="${esc(next)}" />
      <button type="submit">${BUTTON_LABEL[type] ?? "אישור"}</button>
    </form>
  </main>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Never cache a page holding a one-time token.
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const token_hash = String(form.get("token_hash") ?? "");
  const type = asOtpType(String(form.get("type") ?? "") || null);
  const next = safeNext(String(form.get("next") ?? "") || null, type);

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // 303: the browser follows with a GET after our POST.
      return NextResponse.redirect(`${origin}${next}`, 303);
    }
  }

  // Tell /login which link failed: a spent signup token usually means she is
  // already confirmed, while a dead recovery token needs a fresh request.
  const reason = type ? `&type=${type}` : "";
  return NextResponse.redirect(`${origin}/login?error=auth${reason}`, 303);
}
