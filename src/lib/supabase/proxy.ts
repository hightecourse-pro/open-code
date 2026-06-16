import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on each request.
 * Called from the root `proxy.ts` (Next.js 16's renamed Middleware).
 *
 * IMPORTANT: this only keeps the session fresh — it is NOT authorization.
 * Real gating happens in layouts/route handlers (requireRole / requireActiveSub)
 * backed by RLS. See the plan's auth section.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Until Supabase is configured (no .env.local yet), skip session refresh so
  // the app still serves pages. Once the env vars exist, refresh kicks in.
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touch the session so expired tokens get refreshed into the response cookies.
  await supabase.auth.getUser();

  return response;
}
