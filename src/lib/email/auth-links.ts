// The link a member actually clicks in an auth email.
//
// Supabase hands us a `<project>.supabase.co/auth/v1/verify?...&redirect_to=`
// link. That link funnels into the PKCE `?code=` exchange, which only works in
// the SAME browser that started the flow — a woman who signs up on her laptop
// and opens the mail on her phone gets "the link expired" on a link she never
// clicked. It also depends on `redirect_to` being allow-listed in Supabase, and
// silently falls back to the Site URL when it isn't.
//
// So every auth email links to OUR domain instead, at /auth/confirm, which
// verifies the token server-side (verifyOtp + token_hash) and works from any
// browser and any device.

import { getSiteUrl } from "@/lib/site";

/** Supabase's `email_action_type` → the OTP type `/auth/confirm` verifies. */
const OTP_TYPE: Record<string, string> = {
  recovery: "recovery",
  signup: "signup",
  invite: "invite",
  magiclink: "magiclink",
  email: "email",
  email_change: "email_change",
  // GoTrue splits an address change into two mails but verifies both as one
  // type — passing its raw action type through would produce a dead link.
  email_change_current: "email_change",
  email_change_new: "email_change",
};

/** Where she should land once the token is verified. */
const LANDING: Record<string, string> = {
  recovery: "/reset-password",
  email_change: "/profile",
};

/** Only same-origin paths: an emailed `next` must never bounce her off-site. */
function isSafePath(path: string | null | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

function landingFor(redirectTo: string | null, otpType: string): string {
  if (redirectTo) {
    try {
      const next = new URL(redirectTo).searchParams.get("next");
      if (isSafePath(next)) return next;
    } catch {
      // Not an absolute URL we can read — fall through to the default.
    }
  }
  return LANDING[otpType] ?? "/forum";
}

/**
 * Rewrite a Supabase `/auth/v1/verify` link into our own `/auth/confirm` link.
 * Idempotent: anything that isn't a verify link is returned untouched, so a
 * caller that already builds the right link stays correct.
 */
export function toSiteAuthLink(actionUrl: string): string {
  let url: URL;
  try {
    url = new URL(actionUrl);
  } catch {
    return actionUrl;
  }
  if (!url.pathname.startsWith("/auth/v1/verify")) return actionUrl;

  const token = url.searchParams.get("token");
  const otpType = OTP_TYPE[url.searchParams.get("type") ?? ""];
  // An action type we don't recognise is safer left alone than turned into a
  // link /auth/confirm would reject.
  if (!token || !otpType) return actionUrl;

  const next = landingFor(url.searchParams.get("redirect_to"), otpType);
  return (
    `${getSiteUrl()}/auth/confirm` +
    `?token_hash=${encodeURIComponent(token)}` +
    `&type=${encodeURIComponent(otpType)}` +
    `&next=${encodeURIComponent(next)}`
  );
}
