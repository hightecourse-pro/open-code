import { FileText } from "lucide-react";
import type { AttachmentView } from "@/lib/attachments";

const fmtSize = (b: number) =>
  b >= 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`;

/**
 * What hangs on a post, comment or message: images inline (click opens the
 * full file), everything else as a download chip. URLs arrive signed and
 * short-lived from the server — nothing here is a permanent address.
 */
export function AttachmentList({
  items,
  compact = false,
}: {
  items: AttachmentView[];
  compact?: boolean;
}) {
  if (items.length === 0) return null;
  const images = items.filter((a) => a.isImage);
  const files = items.filter((a) => !a.isImage);

  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((a) => (
            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL */}
              <img
                src={a.url}
                alt={a.fileName}
                loading="lazy"
                className={
                  compact
                    ? "max-h-40 max-w-full rounded-lg border border-ink-200 object-contain"
                    : "max-h-72 max-w-full rounded-xl border border-ink-200 object-contain"
                }
              />
            </a>
          ))}
        </div>
      )}
      {files.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 w-fit max-w-full bg-ink-50 border border-ink-200 rounded-lg px-2.5 py-1.5 hover:border-brand-purple transition-colors"
        >
          <FileText size={14} className="text-brand-purple shrink-0" />
          <span className="text-[12px] text-ink-800 truncate" dir="ltr">
            {a.fileName}
          </span>
          <span className="text-[10.5px] text-ink-400 shrink-0">{fmtSize(a.sizeBytes)}</span>
        </a>
      ))}
    </div>
  );
}
