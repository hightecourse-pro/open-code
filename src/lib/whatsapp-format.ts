// Human-readable bodies for inbound WhatsApp message types that carry no
// text of their own (the owner, 6/10: a shared contact showed as "[הודעה]"
// and the number was nowhere to be seen). Pure - no I/O.

export interface WaSharedContact {
  name?: { formatted_name?: string; first_name?: string; last_name?: string };
  phones?: { phone?: string; wa_id?: string; type?: string }[];
  emails?: { email?: string }[];
  org?: { company?: string };
}
export interface WaSharedLocation {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
}

/** "👤 איש קשר: מיכל Apps · +972 54-425-5549" - one line per shared contact. */
export function formatSharedContacts(contacts: WaSharedContact[] | undefined | null): string {
  if (!contacts?.length) return "";
  return contacts
    .map((c) => {
      const name =
        c.name?.formatted_name?.trim() || [c.name?.first_name, c.name?.last_name].filter(Boolean).join(" ").trim() || "ללא שם";
      // The same number often arrives twice (CELL + VOICE) - show each once.
      const phones = [...new Set((c.phones ?? []).map((p) => p.phone?.trim() || (p.wa_id ? `+${p.wa_id}` : "")).filter(Boolean))];
      const emails = [...new Set((c.emails ?? []).map((e) => e.email?.trim() ?? "").filter(Boolean))];
      const parts = [`👤 איש קשר: ${name}`, ...phones, ...emails];
      if (c.org?.company) parts.push(c.org.company);
      return parts.join(" · ");
    })
    .join("\n");
}

/** "📍 מיקום: <name/address> · https://maps.google.com/?q=lat,lng" */
export function formatSharedLocation(loc: WaSharedLocation | undefined | null): string {
  if (!loc || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") return "";
  const label = [loc.name, loc.address].filter(Boolean).join(", ");
  return `📍 מיקום${label ? `: ${label}` : ""} · https://maps.google.com/?q=${loc.latitude},${loc.longitude}`;
}

/**
 * A template parameter Meta will accept. Their rule (error 132018, "There's
 * an issue with the parameters in your template"): no line breaks, no tabs,
 * no run of more than four spaces - and text pasted from a document often
 * carries invisible bidi / zero-width marks that trip the same check (the
 * owner, 11/10, with a link in the content). Links themselves are fine.
 * One line, single spaces, nothing invisible.
 *
 * The character classes are built from code points on purpose: literal
 * zero-width / line-separator characters inside a regex literal broke the
 * build once (11/10).
 */
const ch = (...codes: number[]) => codes.map((c) => String.fromCharCode(c)).join("");
const WA_INVISIBLE = new RegExp(`[${ch(0x200b, 0x200c, 0x200d, 0xfeff, 0x200e, 0x200f)}${ch(0x202a)}-${ch(0x202e)}${ch(0x2066)}-${ch(0x2069)}]`, "g");
const WA_BREAKS = new RegExp(`[${ch(0x00a0, 0x2028, 0x2029, 0x09, 0x0d, 0x0a)}]+`, "g");
const WA_CONTROL = new RegExp(`[${ch(0x01)}-${ch(0x1f)}${ch(0x7f)}]`, "g");

/** Meta's "system" message payload - the contact changed her number, or her device identity changed. */
export interface WaSystemNotice {
  type?: string;
  body?: string;
  /** The contact's NEW WhatsApp id after a number change. */
  wa_id?: string;
  identity?: string;
}

/** 972507313233 → 050-7313233; anything else stays as +number. */
export function prettyWaNumber(waId: string): string {
  const d = String(waId ?? "").replace(/\D/g, "");
  if (/^972\d{9}$/.test(d)) return `0${d.slice(3, 5)}-${d.slice(5)}`;
  return d ? `+${d}` : "";
}

/**
 * The Hebrew line the team inbox shows for a system notice (the owner, 2/11: ״תציג גם הודעות מערכת
 * אצלנו״). A number change names both numbers; a device change says so; anything else quotes Meta's text.
 */
export function formatSystemNotice(sys: WaSystemNotice | undefined | null, from: string): string {
  const type = (sys?.type ?? "").toLowerCase();
  const body = sys?.body ?? "";
  if (/changed_number/.test(type) || /changed from .+ to .+/i.test(body)) {
    const m = body.match(/from\s+\+?(\d+)\s+to\s+\+?(\d+)/i);
    const oldN = m?.[1] ?? from;
    const newN = sys?.wa_id ?? m?.[2] ?? "";
    return newN
      ? `איש הקשר החליף מספר בווטסאפ: מ-${prettyWaNumber(oldN)} ל-${prettyWaNumber(newN)}. הודעות חדשות ממנה יגיעו מהמספר החדש.`
      : `איש הקשר החליף מספר בווטסאפ (${prettyWaNumber(oldN)}).`;
  }
  if (/identity/.test(type)) return "הזיהוי של המכשיר של איש הקשר השתנה (מכשיר חדש או התקנה מחדש של ווטסאפ).";
  return body ? `הודעת מערכת מווטסאפ: ${body}` : "הודעת מערכת מווטסאפ.";
}

/**
 * Her edit or deletion of one of her own messages reaches the Cloud API only as
 * an "unsupported" event that names the action - the new text never arrives
 * (Meta: UNSUPPORTED_TYPE "edit"; "revoke" for a deletion). The team line says
 * what happened (the owner, 5/11: ״תעשה אפשרות עריכה בווצאפ״). Null for any
 * other unsupported type - those keep the generic placeholder.
 */
export function formatUnsupportedNotice(type: string | undefined | null): string | null {
  const t = (type ?? "").toLowerCase();
  if (t === "edit") return "ערכה הודעה קודמת שלה - הנוסח המעודכן נראה רק בטלפון.";
  if (t === "revoke") return "מחקה אצלה הודעה קודמת - כאן היא נשארת כפי שהתקבלה.";
  return null;
}

export function cleanWaParam(value: string): string {
  return value.replace(WA_INVISIBLE, "").replace(WA_BREAKS, " ").replace(WA_CONTROL, " ").replace(/ {2,}/g, " ").trim();
}
