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
