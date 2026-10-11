import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOT_UA_RE, deviceOf, normalizeVisitPath, visitAreaOf } from "@/lib/visits";

export const dynamic = "force-dynamic";

const COOKIE = "oc_vid";
const COOKIE_MAX_AGE = 400 * 24 * 3600;

/**
 * The visits beacon (the owner, 11/10). The PageViewTracker in the root layout
 * POSTs {path, referrer, search} on every navigation; this writes one
 * page_views row. Bots never reach the beacon (no JS) and are filtered by UA
 * anyway; admin and API paths are dropped. The anonymous visitor id lives in
 * an httpOnly cookie set here; a logged-in member is also recorded by profile.
 * Always 204 - a failed count must never surface in the page.
 */
export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA_RE.test(ua)) return new Response(null, { status: 204 });

  let body: { path?: unknown; referrer?: unknown; search?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  const path = normalizeVisitPath(body.path);
  if (!path) return new Response(null, { status: 204 });

  const cookies = Object.fromEntries(
    (req.headers.get("cookie") ?? "")
      .split(";")
      .map((c) => c.trim().split("="))
      .filter((kv) => kv.length === 2)
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
  let visitor = typeof cookies[COOKIE] === "string" ? cookies[COOKIE] : "";
  const fresh = !/^[0-9a-f-]{36}$/.test(visitor);
  if (fresh) visitor = crypto.randomUUID();

  let profileId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    profileId = data.user?.id ?? null;
  } catch {
    /* anonymous */
  }

  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 300) : null;
  const search = typeof body.search === "string" ? body.search.slice(0, 500) : "";
  const utm = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  try {
    await createAdminClient().from("page_views").insert({
      area: visitAreaOf(path),
      path,
      visitor,
      profile_id: profileId,
      // Our own pages as referrer carry no information - keep external ones only.
      referrer: referrer && !/^https?:\/\/(app\.)?opencode\.org\.il|open-code-psi\.vercel\.app|localhost/.test(referrer) ? referrer : null,
      utm_source: utm.get("utm_source")?.slice(0, 100) ?? null,
      utm_campaign: utm.get("utm_campaign")?.slice(0, 100) ?? null,
      device: deviceOf(ua),
    });
  } catch (e) {
    console.error("[track] insert failed", String(e));
  }

  const res = new Response(null, { status: 204 });
  if (fresh) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.headers.append("set-cookie", `${COOKIE}=${visitor}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly${secure}`);
  }
  return res;
}
