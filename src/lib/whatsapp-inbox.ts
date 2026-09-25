import { createAdminClient } from "@/lib/supabase/admin";

/**
 * How many WhatsApp conversations wait for the team (the owner, 25/9: an
 * indication on the admin nav): contacts whose last inbound message is newer
 * than anything the team sent them.
 */
export async function waAwaitingReplyCount(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data: contacts } = await admin
      .from("wa_contacts")
      .select("id, last_inbound_at")
      .not("last_inbound_at", "is", null)
      .order("last_inbound_at", { ascending: false })
      .limit(300);
    if (!contacts?.length) return 0;
    const ids = contacts.map((c) => c.id);
    const { data: outs } = await admin
      .from("wa_messages")
      .select("contact_id, created_at")
      .in("contact_id", ids)
      .eq("direction", "out")
      .order("created_at", { ascending: false })
      .limit(2000);
    const lastOut = new Map<string, string>();
    for (const o of outs ?? []) if (!lastOut.has(o.contact_id)) lastOut.set(o.contact_id, o.created_at);
    return contacts.filter((c) => {
      const out = lastOut.get(c.id);
      return !out || new Date(c.last_inbound_at as string).getTime() > new Date(out).getTime();
    }).length;
  } catch {
    return 0;
  }
}
