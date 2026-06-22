"use client";

import { useEffect, useRef, useState } from "react";
import { NEDARIM_IFRAME_URL } from "@/lib/payments/nedarim";
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
        תודה רבה. אנחנו מפעילות את החשבון שלך ברגעים אלה.
        <a href="/feed" className="block mt-2 font-semibold text-brand-purple underline">
          להמשך לקהילה ←
        </a>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert variant="danger">{error}</Alert>}
      {status === "processing" && (
        <Alert variant="info">מעבדות את התשלום… אל תסגרי את החלון.</Alert>
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
        {status === "processing" ? "מעבדות…" : "לתשלום מאובטח"}
      </Button>
    </div>
  );
}
