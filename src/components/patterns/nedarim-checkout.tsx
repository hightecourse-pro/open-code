"use client";

import { useEffect, useRef, useState } from "react";
import { NEDARIM_IFRAME_URL } from "@/lib/payments/nedarim";
import { checkMembershipActive } from "@/app/join/actions";
import { Alert, Button } from "@/components/ui";

type Status = "idle" | "processing" | "success" | "error";

/**
 * Real Nedarim Plus card form. The iframe lives on Nedarim's domain; we drive
 * it via postMessage and listen for the transaction result. The authoritative
 * activation still arrives via the server CallBack webhook.
 */
export function NedarimCheckout({ fields }: { fields: Record<string, string> }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(420);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activationTimedOut, setActivationTimedOut] = useState(false);

  // After a successful charge, wait for the Nedarim CallBack to activate the
  // member (it's asynchronous), then continue — avoids bouncing back to /join.
  useEffect(() => {
    if (status !== "success") return;
    let cancelled = false;
    let tries = 0;
    async function poll() {
      if (cancelled) return;
      tries += 1;
      if (await checkMembershipActive()) {
        window.location.href = "/feed";
        return;
      }
      if (tries >= 20) {
        setActivationTimedOut(true);
        return;
      }
      setTimeout(poll, 2000);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      let raw: unknown = e.data;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          return;
        }
      }
      if (!raw || typeof raw !== "object") return;
      const data = raw as Record<string, unknown>;

      // Ignore browser-extension / React-DevTools chatter (and don't let
      // arbitrary postMessages drive the payment UI).
      if (typeof data.source === "string") return;

      // Diagnostic — shows exactly what Nedarim posts back (check the console).
      console.log("[nedarim]", data);

      const name = (data.Name ?? data.name) as string | undefined;
      if (name === "Height") {
        setHeight(Number(data.Value ?? data.value) || 420);
        return;
      }

      // Result message. Nedarim's exact shape can vary, so be generous: look at
      // the message Value (or the message itself) for a Status field.
      const v = (data.Value ?? data.value ?? data) as Record<string, unknown>;
      const st = String(v.Status ?? v.status ?? "").toLowerCase();
      if (!st) return;

      if (st === "ok" || st === "success" || st === "1") {
        setStatus("success");
      } else if (st === "error" || st === "fail" || st === "0") {
        setStatus("error");
        setError(
          (v.Message as string) ?? (v.message as string) ?? "התשלום לא הושלם. בואי ננסה שוב."
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function post(name: string, value: unknown) {
    ref.current?.contentWindow?.postMessage({ Name: name, Value: value }, "*");
  }

  if (status === "success") {
    return (
      <Alert variant="success" title="התשלום התקבל! 💜">
        {activationTimedOut ? (
          <>
            תודה רבה! ההפעלה אורכת רגע. רענני את העמוד בעוד דקה —
            <a href="/feed" className="font-semibold text-brand-purple underline">
              {" "}או נסי להמשיך לקהילה
            </a>
            . אם זה לא נפתח, נעדכן אותך במייל.
          </>
        ) : (
          "תודה רבה. מפעיל את החשבון שלך — עוד רגע נעביר אותך לקהילה…"
        )}
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert variant="danger">{error}</Alert>}
      {status === "processing" && (
        <Alert variant="info">מעבד את התשלום… אל תסגרי את החלון.</Alert>
      )}
      <iframe
        ref={ref}
        src={NEDARIM_IFRAME_URL}
        title="תשלום מאובטח — נדרים פלוס"
        className="w-full rounded-md border border-ink-200"
        style={{ height }}
        onLoad={() => post("GetHeight", "")}
      />
      <Button
        type="button"
        onClick={() => {
          setError(null);
          setStatus("processing");
          post("FinishTransaction2", fields);
        }}
        disabled={status === "processing"}
        className="w-full"
      >
        {status === "processing" ? "מעבד…" : "לתשלום מאובטח"}
      </Button>
    </div>
  );
}
