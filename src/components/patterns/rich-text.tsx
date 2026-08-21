import { isRichHtml, parseRichText } from "@/lib/rich-text-lite";

/**
 * The one renderer for community bodies. New content is editor HTML
 * (sanitized by the allowlist at save); anything older is legacy marker text
 * and takes the token path. `invert` adapts colors to a dark bubble.
 */
export function MessageBody({
  body,
  className,
  invert = false,
}: {
  body: string;
  className?: string;
  invert?: boolean;
}) {
  if (!isRichHtml(body)) return <RichText body={body} className={className} />;
  return (
    <div
      className={[
        className ?? "",
        "break-words",
        "[&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-1",
        "[&_h3]:font-display [&_h3]:font-bold [&_h3]:text-[1.05em] [&_h3]:mt-1.5 [&_h3]:mb-0.5",
        "[&_p]:my-0.5 [&_p]:min-h-[1em]",
        invert
          ? "[&_a]:text-white [&_a]:underline [&_b]:text-white [&_strong]:text-white [&_code]:bg-white/25"
          : "[&_a]:text-brand-purple [&_a]:underline [&_b]:text-ink-1000 [&_strong]:text-ink-1000 [&_code]:bg-ink-100",
        "[&_code]:font-mono [&_code]:text-[0.92em] [&_code]:rounded [&_code]:px-1",
      ].join(" ")}
      // Sanitized against the allowlist in lib/rich-text at save time; the
      // renderer trusts only what that gate let through.
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

/**
 * Renders what a member wrote, with her light formatting applied. The body is
 * plain text all the way from the database — this turns markers into elements
 * at display time, so nothing she types can inject markup.
 */
export function RichText({ body, className }: { body: string; className?: string }) {
  const lines = parseRichText(body);
  return (
    <div className={className}>
      {lines.map((tokens, i) => (
        <p key={i} className="min-h-[1em] break-words">
          {tokens.map((t, j) => {
            switch (t.kind) {
              case "bold":
                return (
                  <b key={j} className="font-bold text-ink-1000">
                    {t.text}
                  </b>
                );
              case "italic":
                return (
                  <i key={j} className="italic">
                    {t.text}
                  </i>
                );
              case "strike":
                return (
                  <s key={j} className="opacity-70">
                    {t.text}
                  </s>
                );
              case "code":
                return (
                  <code
                    key={j}
                    dir="ltr"
                    className="font-mono text-[0.92em] bg-ink-100 rounded px-1 py-px"
                  >
                    {t.text}
                  </code>
                );
              case "link":
                return (
                  <a
                    key={j}
                    href={t.href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    dir="ltr"
                    className="text-brand-purple underline break-all"
                  >
                    {t.text}
                  </a>
                );
              default:
                return <span key={j}>{t.text}</span>;
            }
          })}
        </p>
      ))}
    </div>
  );
}
