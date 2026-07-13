import Link from "next/link";
import { KeyRound } from "lucide-react";

/** Shown above an AI tool when the member has no active Google key — makes the
 * "not active yet" state obvious before she tries to use it. */
export function AiKeyBanner({ hasKey }: { hasKey: boolean }) {
  if (hasKey) return null;
  return (
    <div className="bg-tint-warm border border-[#F8D98C] rounded-md p-4 text-[13.5px] text-[#8C5E0E] flex items-start gap-2.5">
      <KeyRound size={18} className="shrink-0 mt-0.5" />
      <span>
        הכלי הזה עדיין <b>לא פעיל</b> אצלך — הוא עובד עם מפתח Google חינמי משלך.{" "}
        <Link href="/ai/keys" className="font-semibold underline">
          הוספת מפתח (דקה)
        </Link>{" "}
        ונצא לדרך 💜
      </span>
    </div>
  );
}
