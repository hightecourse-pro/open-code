"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui";
import { cn } from "@/lib/utils";
import { adminCancelSubscription, adminKevaAction } from "@/app/(admin)/admin/actions";

/**
 * Subscription + standing-order controls on the member admin page (the owner,
 * 3/9): cancel her subscription in OUR system (e.g. after a refused charge),
 * and manage the Nedarim keva directly — freeze / reactivate / delete — now
 * that Nedarim exposed the API (their support, 3/9).
 */
export function MemberSubscriptionPanel({
  profileId,
  memberTier,
  subStatus,
  kevaIds,
}: {
  profileId: string;
  memberTier: string | null;
  subStatus: string | null;
  kevaIds: string[];
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const hasLiveSub = subStatus === "active" || subStatus === "trialing" || subStatus === "past_due";

  function runKeva(kevaId: string, action: "DisableKeva" | "EnableKevaNew" | "DeleteKeva", label: string) {
    const warning =
      action === "DeleteKeva"
        ? `לבטל לצמיתות את הוראת הקבע ${kevaId} בנדרים? אי אפשר להחזיר — חידוש ידרוש הקמה חדשה עם הכרטיס.`
        : `${label} את הוראת הקבע ${kevaId} בנדרים?`;
    if (!confirm(warning)) return;
    start(async () => {
      const r = await adminKevaAction(kevaId, action);
      setResult({ ok: r.ok, text: `${label} (${kevaId}): ${r.ok ? "בוצע ✓" : "נכשל"} — תשובת נדרים: ${r.detail}` });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap text-[13px]">
        <span className="text-ink-500">מנוי במערכת:</span>
        <span className={cn("font-bold", hasLiveSub ? "text-success" : "text-ink-700")}>
          {subStatus ? subStatus : "אין רישום מנוי"}
        </span>
        <span className="text-ink-300">·</span>
        <span className="text-ink-500">דרגה:</span>
        <span className="font-bold text-ink-900">{memberTier ?? "—"}</span>
      </div>

      {result && <Alert variant={result.ok ? "success" : "danger"}>{result.text}</Alert>}

      {hasLiveSub && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              confirm(
                "לבטל את המנוי שלה במערכת? המנוי יסומן כמבוטל, הדרגה תרד לחינמית והגישה לחומרי הקורסים תיסגר. הוראת הקבע בנדרים לא מבוטלת כאן — לזה משמשים הכפתורים למטה."
              )
            )
              start(async () => {
                const r = await adminCancelSubscription(profileId);
                setResult(
                  r.error ? { ok: false, text: r.error } : { ok: true, text: "המנוי בוטל במערכת — הדרגה ירדה לחינמית." }
                );
              });
          }}
          className="w-fit text-[13px] font-bold text-danger border border-danger/40 rounded-md px-3 py-1.5 hover:bg-danger-bg transition-colors disabled:opacity-50"
        >
          ביטול המנוי במערכת
        </button>
      )}

      <div className="border-t border-ink-100 pt-3">
        <div className="text-xs font-semibold text-ink-700 mb-1.5">
          הוראות קבע בנדרים {kevaIds.length === 0 && <span className="font-normal text-ink-400">— לא נמצאו ברישומים שלנו</span>}
        </div>
        {kevaIds.map((k, i) => (
          <div key={k} className="flex items-center gap-2 py-1.5 flex-wrap">
            <span className="font-mono text-[13px] text-ink-900" dir="ltr">
              {k}
            </span>
            {i === 0 && kevaIds.length > 1 && (
              <span className="text-[10px] font-bold bg-tint-purple text-brand-purple px-1.5 py-0.5 rounded-full">
                החדשה ביותר
              </span>
            )}
            <span className="ms-auto flex items-center gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => runKeva(k, "DisableKeva", "הקפאה")}
                className="text-[11.5px] font-semibold text-[#8C5E0E] bg-tint-warm rounded-md px-2 py-1 hover:opacity-80 disabled:opacity-50"
              >
                הקפאה
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => runKeva(k, "EnableKevaNew", "הפעלה מחדש")}
                className="text-[11.5px] font-semibold text-success bg-tint-mint rounded-md px-2 py-1 hover:opacity-80 disabled:opacity-50"
              >
                הפעלה מחדש
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => runKeva(k, "DeleteKeva", "ביטול לצמיתות")}
                className="text-[11.5px] font-semibold text-danger bg-danger-bg rounded-md px-2 py-1 hover:opacity-80 disabled:opacity-50"
              >
                ביטול לצמיתות
              </button>
            </span>
          </div>
        ))}
        <p className="text-[11.5px] text-ink-400 mt-1">
          הפעולות רצות מול נדרים פלוס ומחזירות את התשובה שלהם כלשונה. בסטייג&apos;ינג הן חסומות (מגן).
        </p>
      </div>
    </div>
  );
}
