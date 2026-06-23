import { createClient } from "@/lib/supabase/server";
import type { TaxonomyKind } from "@/types/database";

export type TaxonomyOption = { value: string; label: string };

/**
 * Active taxonomy values grouped by kind, as {value,label} options. Used to
 * populate profile questions whose list is maintained in Admin → Configuration
 * (e.g. technologies, regions) so every such field shares one editable source.
 */
export async function getTaxonomyOptions(): Promise<Partial<Record<TaxonomyKind, TaxonomyOption[]>>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("config_taxonomies")
    .select("kind, value, label_he")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const out: Partial<Record<TaxonomyKind, TaxonomyOption[]>> = {};
  for (const t of data ?? []) {
    (out[t.kind] ??= []).push({ value: t.value, label: t.label_he });
  }
  return out;
}
