import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TaxonomyKind } from "@/types/database";

export type TaxonomyOption = { value: string; label: string; group?: string | null };

async function readTaxonomies(
  supabase: SupabaseClient<Database>
): Promise<Partial<Record<TaxonomyKind, TaxonomyOption[]>>> {
  const { data } = await supabase
    .from("config_taxonomies")
    .select("kind, value, label_he, group_he")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const out: Partial<Record<TaxonomyKind, TaxonomyOption[]>> = {};
  for (const t of data ?? []) {
    (out[t.kind] ??= []).push({ value: t.value, label: t.label_he, group: t.group_he ?? null });
  }
  return out;
}

/**
 * Active taxonomy values grouped by kind, as {value,label} options. Used to
 * populate profile questions whose list is maintained in Admin → Configuration
 * (e.g. technologies, regions) so every such field shares one editable source.
 */
export async function getTaxonomyOptions(): Promise<Partial<Record<TaxonomyKind, TaxonomyOption[]>>> {
  return readTaxonomies(await createClient());
}

/**
 * The same lists, read with the service role — for the employer portal only.
 * A hiring client is authenticated by our own signed cookie, not by Supabase,
 * so the cookie-bound client runs as `anon`; config_taxonomies_select is granted
 * TO AUTHENTICATED, so that client sees zero rows and every answer would render
 * as its raw English value ("center" instead of "מרכז"). The table holds no
 * member data — only the configured lists — so nothing private is exposed.
 */
export async function getTaxonomyOptionsForPortal(): Promise<
  Partial<Record<TaxonomyKind, TaxonomyOption[]>>
> {
  return readTaxonomies(createAdminClient());
}
