import { MessageSquareQuote } from "lucide-react";
import { Badge } from "@/components/ui";
import { KIND_LABELS, SOURCE_LABELS, type FeedbackNote } from "@/lib/hackathon-feedback-notes";

const DMY = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Asia/Jerusalem" });

/**
 * ״משובים להאקתון״ - a fold the admin opens with a click (the owner, 6.11), on the
 * member's page and on top of the submission's card. Every quote carries its source;
 * several make a list. Plain <details>, no script, so it renders inside server pages.
 */
export function HackathonFeedbackNotesFold({ notes, compact = false }: { notes: FeedbackNote[]; compact?: boolean }) {
  const n = notes.length;
  return (
    <details
      className={compact ? "rounded-[12px] border border-ink-200 bg-ink-50/60 px-3.5 py-2" : "bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm"}
      data-testid="hackathon-feedback-notes"
      data-count={n}
    >
      <summary className="cursor-pointer list-none flex items-center gap-2 flex-wrap font-display font-bold text-[15px] text-ink-1000 marker:hidden [&::-webkit-details-marker]:hidden">
        <MessageSquareQuote size={16} className="text-brand-pink-deep" />
        משובים להאקתון
        <Badge variant={n ? "pink" : "gray"}>{n}</Badge>
        <span className="text-[12px] font-normal text-ink-500">{n ? "לחיצה לפתיחה" : "אין עדיין"}</span>
      </summary>
      {n > 0 && (
        <ul className="mt-3 flex flex-col gap-2.5">
          {notes.map((x) => (
            <FeedbackNoteItem key={x.id} note={x} />
          ))}
        </ul>
      )}
    </details>
  );
}

export function FeedbackNoteItem({ note, withName = false }: { note: FeedbackNote; withName?: boolean }) {
  return (
    <li className="rounded-[12px] border border-ink-100 bg-white px-3.5 py-2.5" data-testid="feedback-note" data-source={note.source}>
      <p className="text-[13.5px] leading-relaxed text-ink-900 whitespace-pre-line break-words">{note.body}</p>
      <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[12px] text-ink-500">
        {withName && <b className="text-ink-800">{note.displayName}</b>}
        <span data-testid="feedback-note-source">
          מקור: <b className="text-ink-700">{SOURCE_LABELS[note.source]}</b>
        </span>
        <span>· {DMY.format(new Date(note.writtenAt))}</span>
        {note.kind !== "borderline" && <span>· {KIND_LABELS[note.kind]}</span>}
        {note.sourceUrl && (
          <a href={note.sourceUrl} target="_blank" rel="noopener" className="font-semibold text-brand-purple hover:underline">
            למקור ↗
          </a>
        )}
        {note.hiddenAt && <Badge variant="gray">מוסתר</Badge>}
      </div>
    </li>
  );
}
