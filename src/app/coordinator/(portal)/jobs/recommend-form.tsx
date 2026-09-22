"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Select, Textarea } from "@/components/ui";
import { sendJobRecommendation, type ChatState } from "../../actions";

/**
 * "עוד לא הגשנו מועמדות למשרה הזו" - the coordinator recommends one of her
 * graduates (the owner, 16/9). Lands in her team chat + the alerts center.
 */
export function RecommendForm({
  jobId,
  graduates,
}: {
  jobId: string;
  graduates: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<ChatState, FormData>(
    sendJobRecommendation.bind(null, jobId),
    {}
  );

  if (state.ok) {
    return (
      <p className="text-[12.5px] font-semibold text-success py-1">
        ההמלצה נשלחה לצוות ✓ תודה! נעדכן אותך בצ&apos;אט 💜
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 bg-tint-purple/30 border border-[#DDC9EC] rounded-[12px] p-3 mt-1.5">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="על מי את ממליצה?" htmlFor={`rec-g-${jobId}`}>
          <Select id={`rec-g-${jobId}`} name="graduate_id" defaultValue="">
            <option value="">- בחרי בוגרת (לא חובה) -</option>
            {graduates.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="כמה מילים (למה היא מתאימה?)" htmlFor={`rec-n-${jobId}`}>
          <Textarea id={`rec-n-${jobId}`} name="note" rows={2} maxLength={2000} />
        </Field>
      </div>
      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        {pending ? "שולחת…" : "שליחת ההמלצה לצוות 💜"}
      </Button>
    </form>
  );
}
