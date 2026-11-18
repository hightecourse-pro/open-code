"use client";

import { useEffect, useRef, useState } from "react";
import { H } from "@/app/ai-course/theme";
import { NEDARIM_IFRAME_URL, NEDARIM_ORIGIN } from "@/lib/payments/nedarim";
import { isValidIsraeliId } from "@/lib/validators";
import { PATHS, nis } from "@/lib/conference-shared";
import { conferenceOrderStatus, reportConferencePaid } from "../actions";

type Status = "idle" | "processing" | "success" | "error";

/**
 * The Nedarim card form for a conference order - the community checkout's
 * protocol (postMessage with the iframe, the callback as the source of truth)
 * in Hightecourse colors. After a successful charge the order is reported,
 * the callback is given a few seconds to confirm, and she lands on the
 * thank-you page either way.
 */
export function ConferenceCheckout({ fields, token, amountNis }: { fields: Record<string, string>; token: string; amountNis: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(420);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState(fields.Phone ?? "");
  const [idNumber, setIdNumber] = useState(fields.Zeout ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "success") return;
    let cancelled = false;
    (async () => {
      await reportConferencePaid(token).catch(() => null);
      for (let i = 0; i < 6 && !cancelled; i++) {
        const s = await conferenceOrderStatus(token).catch(() => null);
        if (s === "paid") break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) window.location.href = `${PATHS.done}?o=${token}`;
    })();
    return () => {
      cancelled = true;
    };
  }, [status, token]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
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
      if (typeof data.source === "string") return;
      const name = (data.Name ?? data.name) as string | undefined;
      if (name === "Height") {
        setHeight(Number(data.Value ?? data.value) || 420);
        return;
      }
      const v = (data.Value ?? data.value ?? data) as Record<string, unknown>;
      const st = String(v.Status ?? v.status ?? "").toLowerCase();
      if (!st) return;
      if (st === "ok" || st === "success" || st === "1") setStatus("success");
      else if (st === "error" || st === "fail" || st === "0") {
        setStatus("error");
        setError((v.Message as string) ?? (v.message as string) ?? "התשלום לא הושלם. אפשר לנסות שוב.");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function post(name: string, value: unknown) {
    ref.current?.contentWindow?.postMessage({ Name: name, Value: value }, NEDARIM_ORIGIN);
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl px-5 py-6 text-center" style={{ background: H.yellowSoft }} data-testid="hc-pay-success">
        <div className="text-[22px] font-black" style={{ color: H.navy }}>
          התשלום התקבל
        </div>
        <p className="mt-1 text-[15px]" style={{ color: H.ink }}>
          רושמות אותך… עוד רגע נעביר אותך לאישור.
        </p>
      </div>
    );
  }

  const inputCls = "w-full rounded-xl border-2 bg-white px-3.5 py-2.5 text-[16px] outline-none focus:border-[#004878]";
  return (
    <div className="flex flex-col gap-3" data-testid="hc-checkout">
      {error && (
        <p data-testid="hc-pay-error" className="rounded-xl px-4 py-3 text-[14.5px] font-bold" style={{ background: "#FDECEA", color: H.red }}>
          {error}
        </p>
      )}
      {status === "processing" && (
        <p className="rounded-xl px-4 py-3 text-[14.5px] font-bold" style={{ background: H.yellowSoft, color: H.navy }}>
          מעבדות את התשלום… אל תסגרי את החלון.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hc-pay-phone" className="text-[13.5px] font-bold" style={{ color: H.navy }}>
            נייד (לקבלה)
          </label>
          <input id="hc-pay-phone" name="phone" autoComplete="tel" type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} style={{ borderColor: H.line }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hc-pay-id" className="text-[13.5px] font-bold" style={{ color: H.navy }}>
            ת.ז. של המשלמת
          </label>
          <input id="hc-pay-id" name="idNumber" autoComplete="on" inputMode="numeric" dir="ltr" maxLength={9} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className={inputCls} style={{ borderColor: H.line }} />
        </div>
      </div>
      {fieldError && (
        <p className="-mt-1 text-[13px] font-semibold" style={{ color: H.red }}>
          {fieldError}
        </p>
      )}
      <p className="-mt-1 text-[12.5px]" style={{ color: H.muted }}>
        הפרטים משמשים לאישור התשלום ולקבלה בלבד.
      </p>
      <iframe ref={ref} src={NEDARIM_IFRAME_URL} title="תשלום מאובטח - נדרים פלוס" className="w-full rounded-xl border" style={{ height, borderColor: H.line }} onLoad={() => post("GetHeight", "")} data-testid="hc-pay-iframe" />
      <button
        type="button"
        disabled={status === "processing"}
        data-testid="hc-pay-submit"
        onClick={() => {
          const ph = phone.replace(/\D/g, "");
          const id = idNumber.replace(/\D/g, "");
          if (!/^0\d{8,9}$/.test(ph)) return setFieldError("צריך מספר נייד תקין, למשל 052-1234567");
          if (!isValidIsraeliId(id)) return setFieldError("מספר תעודת הזהות לא נראה תקין");
          setFieldError(null);
          setError(null);
          setStatus("processing");
          post("FinishTransaction2", { ...fields, Phone: ph, Zeout: id });
        }}
        className="inline-flex w-full items-center justify-center rounded-full px-8 py-4 text-[18px] font-black text-white transition-colors disabled:opacity-60"
        style={{ background: H.navy }}
      >
        {status === "processing" ? "מעבדות…" : `לתשלום מאובטח · ${nis(amountNis)} ₪`}
      </button>
    </div>
  );
}
