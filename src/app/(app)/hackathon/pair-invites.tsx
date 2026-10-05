"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { confirmPairInvite, declinePairInvite } from "./actions";

export interface PairInviteView {
  inviterId: string;
  inviterName: string;
  challengeShort: string;
}

/** "X asked to submit the challenge with you" - confirm or pass (the owner, 5/10). */
export function PairInvites({ invites }: { invites: PairInviteView[] }) {
  const [list, setList] = useState(invites);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!list.length && !done) return null;

  function act(inv: PairInviteView, confirm: boolean) {
    setError(null);
    start(async () => {
      const r = confirm ? await confirmPairInvite(inv.inviterId) : await declinePairInvite(inv.inviterId);
      if (r.error) return setError(r.error);
      setList((prev) => prev.filter((x) => x.inviterId !== inv.inviterId));
      setDone(confirm ? `נרשמת לאתגר ״${inv.challengeShort}״ יחד עם ${inv.inviterName} ✓` : `הודענו ל${inv.inviterName} שהפעם לא. היא נשארת רשומה לבד.`);
      if (confirm) setTimeout(() => window.location.reload(), 1200);
    });
  }

  return (
    <section className="bg-tint-warm/60 border border-amber-300 rounded-[18px] p-5 flex flex-col gap-3">
      {done && <Alert variant="success">{done}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}
      {list.map((inv) => (
        <div key={inv.inviterId} className="flex items-center gap-3 flex-wrap">
          <span className="text-[14.5px] text-ink-900">
            👯‍♀️ <b>{inv.inviterName}</b> ביקשה להגיש איתך כזוג את האתגר <b>{inv.challengeShort}</b>. מאשרת?
          </span>
          <span className="ms-auto flex items-center gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => act(inv, true)}>
              כן, נרשמות יחד ✓
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => act(inv, false)}>
              לא הפעם
            </Button>
          </span>
        </div>
      ))}
    </section>
  );
}
