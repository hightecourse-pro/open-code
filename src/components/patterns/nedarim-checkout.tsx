"use client";

import { useEffect, useRef, useState } from "react";
import { NEDARIM_IFRAME_URL } from "@/lib/payments/nedarim";
import { Alert, Button } from "@/components/ui";

/**
 * Real Nedarim Plus card form. The iframe lives on Nedarim's domain; we drive
 * it via postMessage and listen for the transaction result. The authoritative
 * confirmation still arrives via the server CallBack webhook.
 */
export function NedarimCheckout({ fields }: { fields: Record<string, string> }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(420);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as { Name?: string; Value?: unknown } | null;
      if (!data || typeof data !== "object") return;

      if (data.Name === "Height") {
        setHeight(Number(data.Value) || 420);
      }
      if (data.Name === "TransactionResponse") {
        const res = data.Value as { Status?: string; Message?: string } | undefined;
        if (res?.Status === "OK") {
          window.location.href = "/feed";
        } else {
          setError(res?.Message || "התשלום לא הושלם. בואי ננסה שוב.");
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function post(name: string, value: unknown) {
    ref.current?.contentWindow?.postMessage({ Name: name, Value: value }, "*");
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert variant="danger">{error}</Alert>}
      <iframe
        ref={ref}
        src={NEDARIM_IFRAME_URL}
        title="תשלום מאובטח — נדרים פלוס"
        className="w-full rounded-md border border-ink-200"
        style={{ height }}
        onLoad={() => post("GetHeight", "")}
      />
      <Button type="button" onClick={() => post("FinishTransaction2", fields)} className="w-full">
        לתשלום מאובטח
      </Button>
    </div>
  );
}
