import { parseRichText } from "@/lib/rich-text-lite";

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
