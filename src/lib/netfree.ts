/**
 * Netfree (the filtered ISP many members use) blocks the Supabase storage
 * host, so a file served straight from storage - a syllabus, a chat image, a
 * CV, an article picture - simply does not open for them. app.opencode.org.il
 * is allowed. Every storage URL the app hands out is therefore rewritten to
 * /api/files, which streams the same object through our own domain (the owner,
 * 9/10: "תטפל בהורדות לנטפרי… בכל הצגת התמונות וצילומי המסך במערכת").
 *
 * Signed URLs keep their token inside `u`, so what the storage host would have
 * authorised, our route authorises the same way; public objects need nothing.
 * No server imports - usable from either side.
 */
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");

/** `https://<ref>.supabase.co/storage/v1/object/` - public and signed objects both live under it. */
export const STORAGE_OBJECT_PREFIX = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/` : "";

export function isOurStorageUrl(url: string | null | undefined): url is string {
  return !!STORAGE_OBJECT_PREFIX && !!url && url.startsWith(STORAGE_OBJECT_PREFIX);
}

interface SafeUrlOptions {
  /** Ask the browser to save the file under this name instead of opening it. */
  download?: string;
}

/** A storage URL → our same-domain streaming route; any other URL passes through untouched. */
export function netfreeSafeUrl(url: string, opts?: SafeUrlOptions): string;
export function netfreeSafeUrl(url: string | null | undefined, opts?: SafeUrlOptions): string | null;
export function netfreeSafeUrl(url: string | null | undefined, opts?: SafeUrlOptions): string | null {
  if (!url) return null;
  if (!isOurStorageUrl(url)) return url;
  const q = new URLSearchParams({ u: url });
  if (opts?.download) q.set("download", opts.download);
  return `/api/files?${q.toString()}`;
}

/** Rewrites every storage URL inside rendered HTML (article bodies) - src and href alike. */
export function netfreeSafeHtml(html: string): string {
  if (!html || !STORAGE_OBJECT_PREFIX) return html;
  const prefix = STORAGE_OBJECT_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b(src|href)="(${prefix}[^"]*)"`, "g");
  return html.replace(re, (_m, attr: string, raw: string) => {
    const safe = netfreeSafeUrl(raw.replace(/&amp;/g, "&"));
    return `${attr}="${safe.replace(/&/g, "&amp;")}"`;
  });
}
