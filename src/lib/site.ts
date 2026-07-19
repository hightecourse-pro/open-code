/**
 * The canonical public URL of the app. Email links (auth redirects, digest
 * CTAs) must always be absolute and point at production — never localhost.
 * Priority: explicit env → Vercel's production domain → local dev.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
