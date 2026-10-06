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
