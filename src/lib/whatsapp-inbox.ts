import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "New" in the WhatsApp inbox is per team member (the owner, 11/10): a contact
 * is unread for me when her latest inbound message is newer than the last
 * time I opened her conversation (wa_contact_reads). The sidebar badge counts
 * such PEOPLE, not messages; a teammate who has not looked still sees it
 * after I did.
 */
export interface WaInboxState {
  /** Contacts with an inbound message I have not seen. */
  unread: Set<string>;
  /** Contacts whose latest inbound is newer than anything the team sent them. */
  awaitingReply: Set<string>;
}

export async function waInboxState(adminId: string): Promise<WaInboxState> {
  const unread = new Set<string>();
  const awaitingReply = new Set<string>();
  try {
    const admin = createAdminClient();
    const { data: contacts } = await admin
      .from("wa_contacts")
      .select("id, last_inbound_at")
      .not("last_inbound_at", "is", null)
      .order("last_inbound_at", { ascending: false })
      .limit(500);
    if (!contacts?.length) return { unread, awaitingReply };
    const ids = contacts.map((c) => c.id);
    const [{ data: reads }, { data: outs }] = await Promise.all([
      admin.from("wa_contact_reads").select("contact_id, read_at").eq("admin_id", adminId).in("contact_id", ids),
      admin
        .from("wa_messages")
        .select("contact_id, created_at")
        .in("contact_id", ids)
        .eq("direction", "out")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);
    const readAt = new Map((reads ?? []).map((r) => [r.contact_id, new Date(r.read_at).getTime()]));
    const lastOut = new Map<string, number>();
    for (const o of outs ?? []) if (!lastOut.has(o.contact_id)) lastOut.set(o.contact_id, new Date(o.created_at).getTime());
    for (const c of contacts) {
      const inboundAt = new Date(c.last_inbound_at as string).getTime();
      const seen = readAt.get(c.id);
      if (seen === undefined || inboundAt > seen) unread.add(c.id);
      const out = lastOut.get(c.id);
      if (out === undefined || inboundAt > out) awaitingReply.add(c.id);
    }
  } catch {
    /* a counting failure must never break an admin page */
  }
  return { unread, awaitingReply };
}

/** The sidebar badge: how many people wrote something I have not seen. */
export async function waUnreadContactsCount(adminId: string): Promise<number> {
  return (await waInboxState(adminId)).unread.size;
}

/** I opened her conversation now - read for me (and only me) from this moment. */
export async function markWaContactRead(adminId: string, contactId: string): Promise<void> {
  try {
    await createAdminClient()
      .from("wa_contact_reads")
      .upsert({ contact_id: contactId, admin_id: adminId, read_at: new Date().toISOString() }, { onConflict: "contact_id,admin_id" });
  } catch {
    /* best-effort */
  }
}
