/**
 * A media island (26/10 night): a video, an iframe or an image rendered as
 * one block of markup that React never reconciles inside. NetFree - the
 * filter most of the community browses through - injects its own elements
 * around media (a red "דווח" bar under a video, wrappers around images). When
 * React later updates or removes such a node it finds the DOM changed under
 * it and throws (removeChild / insertBefore on a node that moved) - the sad
 * screen the owner kept seeing on the long pages. Inside an island the
 * injected nodes are nobody's business: React only ever sets the island's
 * innerHTML and removes the island as a whole.
 */
function attr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function iframeHtml(src: string, title: string, className: string): string {
  return `<iframe src="${attr(src)}" title="${attr(title)}" allow="autoplay; fullscreen" allowfullscreen class="${attr(className)}"></iframe>`;
}

export function videoHtml(src: string, className: string): string {
  return `<video src="${attr(src)}" controls preload="metadata" class="${attr(className)}"></video>`;
}

export function imgHtml(src: string, alt: string, className: string, lazy = true): string {
  return `<img src="${attr(src)}" alt="${attr(alt)}" class="${attr(className)}"${lazy ? ' loading="lazy"' : ""} />`;
}

export function MediaIsland({ html, className, testId }: { html: string; className?: string; testId?: string }) {
  return <div className={className} data-media-island data-testid={testId} dangerouslySetInnerHTML={{ __html: html }} />;
}
