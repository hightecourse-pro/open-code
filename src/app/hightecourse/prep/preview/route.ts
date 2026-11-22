import { getProfile, hasHcAccess } from "@/lib/auth";
import { loadPrepById, mailOf } from "@/lib/hc-preconf/data";

export const dynamic = "force-dynamic";

/** The letter of one participant, exactly as it goes out - for everyone the system lets in (?id=). */
export async function GET(req: Request) {
  const profile = await getProfile().catch(() => null);
  if (!hasHcAccess(profile)) return new Response("forbidden", { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const row = await loadPrepById(id);
  if (!row) return new Response("not found", { status: 404 });
  const { html } = mailOf(row);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
