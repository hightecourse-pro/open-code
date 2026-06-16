import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16: "Middleware" is now "Proxy". Same functionality, renamed file.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on every path except static assets and image files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
