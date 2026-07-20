"use server";

import { getPortalClient } from "@/lib/portal/auth";
import { loadCandidates } from "@/lib/portal/candidates";
import { buildFieldCatalogue, interpretQuery } from "@/lib/portal/smart-search";

export type SmartSearchState =
  | { status: "idle" }
  | {
      status: "ok";
      /** Echoed back so the input can stay in sync after a submit. */
      text: string;
      interpretation: string;
      filters: Record<string, string[]>;
      freeText: string;
    }
  | { status: "error"; message: string };

// Every pool failure (no_key / exhausted / error) collapses to one line. The
// client must never learn whether a key is missing, spent or broken.
const UNAVAILABLE = "החיפוש החכם אינו זמין כרגע. אפשר להמשיך לחפש לפי פרמטרים.";

export async function smartSearch(
  _prev: SmartSearchState,
  formData: FormData
): Promise<SmartSearchState> {
  // Server Actions are reachable by direct POST, not only through our UI, so
  // the session is re-checked here and not just on the page.
  const client = await getPortalClient();
  if (!client) return { status: "error", message: "פג תוקף החיבור. יש להתחבר מחדש." };

  const text = String(formData.get("q") ?? "").trim();
  if (!text) return { status: "idle" };

  // The field catalogue is rebuilt on the server rather than accepted from the
  // request, so a tampered POST can't feed arbitrary text into the model prompt
  // or widen the search beyond employer-visible fields.
  const { candidates } = await loadCandidates();
  const result = await interpretQuery(text, buildFieldCatalogue(candidates));

  if (!result.ok) return { status: "error", message: UNAVAILABLE };

  return {
    status: "ok",
    text,
    interpretation: result.query.interpretation,
    filters: result.query.filters,
    freeText: result.query.freeText,
  };
}
