"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui";
import { grantShareManually, type ShareFormState } from "@/app/(admin)/admin/shares/actions";
import { MemberPicker } from "@/app/(admin)/admin/shares/member-picker";

/**
 * ״שיתוף אישי״ of ONE session with ONE woman, right on the session (the owner,
 * 1/11: ״תן לי אפשרות לשתף סשן ספציפי למישהי שלא מנויה״). The same manual
 * share the ניהול › שיתופים screen makes - here the session is already chosen,
 * so she only picks the member. A free member then sees this session open:
 * the recording, the zoom link, the materials, and the reminders.
 */
export function SessionShareForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState<ShareFormState, FormData>(grantShareManually, {});
  return (
    <form action={action} className="flex flex-col gap-2" data-testid="session-share-form">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">{state.ok}</Alert>}
      <input type="hidden" name="content" value={`session:${sessionId}`} />
      <div className="flex flex-wrap items-center gap-2">
        <MemberPicker name="profile_id" />
        <button
          type="submit"
          disabled={pending}
          className="text-[12px] font-semibold rounded-full px-3 py-1.5 bg-brand-gradient text-white disabled:opacity-50 cursor-pointer"
          data-testid="session-share-submit"
        >
          {pending ? "פותחת…" : "שתפי איתה את הסשן"}
        </button>
      </div>
    </form>
  );
}
