// A "file" application question (the owner, 19/11) stores its answer as the
// string `file:<attachment id>` - a plain string, so every reader that only
// knows strings / numbers / arrays keeps working, and the id can still be told
// from a typed answer after the question changed type or was removed. The
// document itself is an `attachments` row (context "application") in the
// private bucket. Isomorphic: no server-only imports - the forms use it too.

export const FILE_ANSWER_RE = /^file:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** The attachment id a stored answer points at, or null for every other answer. */
export function fileAnswerId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = FILE_ANSWER_RE.exec(v.trim());
  return m ? m[1] : null;
}

/** The answer string to store for an uploaded document. */
export function fileAnswer(attachmentId: string): string {
  return `file:${attachmentId}`;
}

/**
 * Every attachment id referenced anywhere in the given answers - the live
 * answers object, a previous-version snapshot, a list of either - deduped.
 */
export function fileAnswerIds(...sources: unknown[]): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || v == null) return;
    const id = fileAnswerId(v);
    if (id) {
      out.add(id);
      return;
    }
    if (Array.isArray(v)) for (const x of v) walk(x, depth + 1);
    else if (typeof v === "object") for (const x of Object.values(v as Record<string, unknown>)) walk(x, depth + 1);
  };
  for (const s of sources) walk(s, 0);
  return [...out];
}

/** What an application document may be: PDF, Word or an image - the bucket's own list minus scripts. */
export const APPLICATION_FILE_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
];
export const APPLICATION_FILE_ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp";
export const APPLICATION_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const APPLICATION_FILE_HINT = "PDF, Word (doc/docx) או תמונה (PNG/JPG/WebP), עד 10MB";
