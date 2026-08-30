// Structured profile links — URL + title + short note (the owner, 31/8).
// Pure module: shared by the wizard editor (client), the save action (server)
// and the portal candidate loader.

export type LinkItem = { url: string; title: string; note: string };

/**
 * Parse a stored answer (or editor JSON) into clean link items. Legacy
 * answers were plain one-URL-per-line strings — those hydrate as URL-only
 * rows so nothing anyone already saved is lost.
 */
export function parseLinkItems(value: unknown): LinkItem[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
      .map((v) => ({
        url: typeof v.url === "string" ? v.url.trim() : "",
        title: typeof v.title === "string" ? v.title.trim() : "",
        note: typeof v.note === "string" ? v.note.trim() : "",
      }))
      .filter((v) => v.url);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((url) => ({ url, title: "", note: "" }));
  }
  return [];
}
