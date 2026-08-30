"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NEDARIM_IFRAME_URL, NEDARIM_ORIGIN } from "@/lib/payments/nedarim";
import { checkMembershipActive } from "@/app/join/actions";
import { Alert, Button, Field, Input } from "@/components/ui";

type Status = "idle" | "processing" | "success" | "error";

/** Israeli mobile: 05X + 7 digits, dashes/spaces allowed while typing. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return /^05\d{8}$/.test(digits) ? digits : null;
}

/** Israeli ID with its check digit (short old IDs are zero-padded). */
function normalizeIsraeliId(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 9) return null;
  const id = digits.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(id[i]) * (i % 2 === 0 ? 1 : 2);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0 ? digits : null;
}

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
  // Nedarim rejects transactions without a phone, and the owner's report needs
  // the ID too; both pre-filled from her profile answers when they exist,
  // editable either way (the receipt goes to these details).
  const [phone, setPhone] = useState(fields.Phone ?? "");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [idNumber, setIdNumber] = useState(fields.Zeout ?? "");
  const [idError, setIdError] = useState<string | null>(null);

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
        window.location.href = "/forum";
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
      // Only the payment iframe may drive this UI — otherwise any window could
      // shout "payment succeeded" and walk the member into the success screen.
      if (e.origin !== NEDARIM_ORIGIN) return;
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
    // Addressed to Nedarim explicitly — card details must never be posted to
    // whatever happens to be in the frame.
    ref.current?.contentWindow?.postMessage({ Name: name, Value: value }, NEDARIM_ORIGIN);
  }

  if (status === "success") {
    // OUR renewal date, said out loud — the Nedarim receipt sometimes prints
    // a confusing "NextDate" from their fixed keva day (e.g. a past 28/08 on
    // a 30/08 signup); the membership month is what we honor.
    const renewal = new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "long",
      timeZone: "Asia/Jerusalem",
    }).format(new Date(Date.now() + 30 * 24 * 3600 * 1000));
    return (
      <Alert variant="success" title="התשלום התקבל! 💜">
        {activationTimedOut ? (
          <>
            תודה רבה! ההפעלה אורכת רגע. רענני את העמוד בעוד דקה —
            <Link href="/forum" className="font-semibold text-brand-purple underline">
              {" "}או נסי להמשיך לקהילה
            </Link>
            . אם זה לא נפתח, נעדכן אותך במייל.
          </>
        ) : (
          <>
            תודה רבה. מפעיל את החשבון שלך — עוד רגע נעביר אותך לקהילה…
            <span className="block mt-1 text-[12.5px]">
              המנוי שלך מתחדש ב-{renewal}; את התאריך המדויק תמיד רואים ב״המנוי שלי״.
            </span>
          </>
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="טלפון נייד" htmlFor="checkout-phone" error={phoneError}>
          <Input
            id="checkout-phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            placeholder="05X-XXXXXXX"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneError(null);
            }}
          />
        </Field>
        <Field label="תעודת זהות" htmlFor="checkout-id" error={idError}>
          <Input
            id="checkout-id"
            inputMode="numeric"
            dir="ltr"
            maxLength={9}
            value={idNumber}
            onChange={(e) => {
              setIdNumber(e.target.value);
              setIdError(null);
            }}
          />
        </Field>
      </div>
      <p className="text-[12px] text-ink-500 -mt-1.5">
        הפרטים משמשים לאישור התשלום ולקבלה — לא מוצגים לאף אחת אחרת.
      </p>
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
          const normalizedPhone = normalizePhone(phone);
          const normalizedId = normalizeIsraeliId(idNumber);
          if (!normalizedPhone) {
            setPhoneError("צריך מספר נייד תקין, למשל 052-1234567 🙂");
          }
          if (!normalizedId) {
            setIdError("מספר תעודת הזהות לא נראה תקין 🙂");
          }
          if (!normalizedPhone || !normalizedId) return;
          setError(null);
          setStatus("processing");
          post("FinishTransaction2", { ...fields, Phone: normalizedPhone, Zeout: normalizedId });
        }}
        disabled={status === "processing"}
        className="w-full"
      >
        {status === "processing" ? "מעבד…" : "לתשלום מאובטח"}
      </Button>
    </div>
  );
}
