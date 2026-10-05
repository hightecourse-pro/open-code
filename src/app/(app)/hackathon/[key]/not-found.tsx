import Link from "next/link";

/** An unknown challenge key - say so inside the community shell. */
export default function ChallengeNotFound() {
  return (
    <div className="max-w-xl flex flex-col gap-3">
      <h1 className="font-display text-[22px] font-black text-ink-1000">האתגר הזה לא נמצא</h1>
      <p className="t-body-sm text-ink-700">אולי הקישור ישן, או שהאתגר עוד לא נחשף. כל האתגרים הפתוחים בעמוד ההאקתון.</p>
      <Link href="/hackathon" className="text-brand-purple font-bold hover:underline w-fit">
        ← לעמוד ההאקתון
      </Link>
    </div>
  );
}
