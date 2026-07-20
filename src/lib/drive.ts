/**
 * Google Drive link helpers. The community shares course/session material as
 * personal Drive links (to get around Netfree). Videos are embedded view-only
 * via the `/preview` form; folders open in a new tab.
 */

/** Turn a Drive file link into an embeddable, view-only `/preview` URL. */
export function driveEmbedUrl(url: string): string | null {
  // https://drive.google.com/file/d/<id>/view?...  |  ...open?id=<id>  |  ...uc?id=<id>
  const byPath = url.match(/\/file\/d\/([^/?#]+)/);
  const byQuery = url.match(/[?&]id=([^&#]+)/);
  const id = byPath?.[1] ?? byQuery?.[1];
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

/** True for Drive folder links (materials). */
export function isDriveFolder(url: string): boolean {
  return /\/folders\//.test(url);
}

/**
 * The Drive object id inside any Drive/Docs URL — files, folders, Docs,
 * Sheets and Slides. Needed to grant/revoke per-member permissions.
 */
export function driveFileId(url: string): string | null {
  // Only Google-hosted links carry a Drive object id — never guess from an
  // arbitrary URL that happens to have an ?id= parameter.
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!/(^|\.)(drive|docs)\.google\.com$/.test(host)) return null;

  const patterns = [
    /\/file\/d\/([^/?#]+)/,
    /\/folders\/([^/?#]+)/,
    // /d/e/… is a *published* doc id, which is not a shareable file id.
    /\/(?:document|spreadsheets|presentation)\/d\/(?!e\/)([^/?#]+)/,
    /[?&]id=([^&#]+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}
