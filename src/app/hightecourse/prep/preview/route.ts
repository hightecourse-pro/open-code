import { getProfile, hasHcAccess } from "@/lib/auth";
import { courseUpdateMailOf, loadPrepById, mailOf } from "@/lib/hc-preconf/data";

export const dynamic = "force-dynamic";

/** The letter of one participant, exactly as it goes out - for everyone the system lets in (?id=; &mail=update = the course update mail, 22/11). */
export async function GET(req: Request) {
  const profile = await getProfile().catch(() => null);
  if (!hasHcAccess(profile)) return new Response("forbidden", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const row = await loadPrepById(id);
  if (!row) return new Response("not found", { status: 404 });
  if (url.searchParams.get("mail") === "update") {
    const m = courseUpdateMailOf(row);
    if (!m) return new Response("no update text for this course", { status: 404 });
    return new Response(m.html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
  }
  const { html } = mailOf(row);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
