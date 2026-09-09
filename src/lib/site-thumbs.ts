// Live-site screenshots, served from INSIDE the page (the owner, 9/9):
// members and employers behind Netfree get external images replaced with a
// "sent for review" placeholder, so the mShots screenshot is fetched once on
// the server, cached in site_thumbnails, and inlined as a base64 data URI.
//
// mShots serves a GIF placeholder while it renders a site; only a real JPEG
// is cached, so a "generating" frame is never frozen into the profile — the
// next view simply tries again.
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 300 * 1024; // a 560px JPEG is ~30-80KB; anything bigger is suspect
const FETCH_TIMEOUT_MS = 6000;

/** Which links deserve a screenshot — a live site, not a code host. */
export function isLiveSiteUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return !/(^|\.)(github\.com|gitlab\.com|bitbucket\.org)$/.test(host);
  } catch {
    return false;
  }
}

function hashOf(url: string): string {
  return createHash("sha256").update(url.trim()).digest("hex").slice(0, 40);
}

async function fetchShot(url: string): Promise<{ contentType: string; base64: string } | null> {
  try {
    const res = await fetch(
      `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=560`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "follow" }
    );
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    // The loading frame is a GIF; a finished screenshot is a JPEG.
    if (!contentType.includes("jpeg")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;
    return { contentType: "image/jpeg", base64: buf.toString("base64") };
  } catch {
    return null;
  }
}

/**
 * Data URIs for whichever of the given urls have a cached screenshot; cache
 * misses trigger a fetch (in parallel) and are stored when mShots has the
 * shot ready. Call it at profile save to warm the cache, and at render to
 * read it — the page inlines whatever is available.
 */
export async function siteThumbs(urls: string[]): Promise<Record<string, string>> {
  const live = [...new Set(urls.filter(isLiveSiteUrl))];
  if (live.length === 0) return {};
  const admin = createAdminClient();
  const byHash = new Map(live.map((u) => [hashOf(u), u]));

  const { data: rows } = await admin
    .from("site_thumbnails")
    .select("url_hash, content_type, data_base64")
    .in("url_hash", [...byHash.keys()]);
  const out: Record<string, string> = {};
  const have = new Set<string>();
  for (const r of rows ?? []) {
    const url = byHash.get(r.url_hash);
    if (!url) continue;
    have.add(r.url_hash);
    out[url] = `data:${r.content_type};base64,${r.data_base64}`;
  }

  const missing = [...byHash.entries()].filter(([h]) => !have.has(h));
  if (missing.length > 0) {
    await Promise.all(
      missing.slice(0, 6).map(async ([hash, url]) => {
        const shot = await fetchShot(url);
        if (!shot) return;
        await admin.from("site_thumbnails").upsert(
          {
            url_hash: hash,
            url,
            content_type: shot.contentType,
            data_base64: shot.base64,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "url_hash" }
        );
        out[url] = `data:${shot.contentType};base64,${shot.base64}`;
      })
    );
  }
  return out;
}
