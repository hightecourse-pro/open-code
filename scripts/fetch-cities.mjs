// Generates src/data/cities.ts from the official Israeli settlements list on
// data.gov.il (מילון יישובים בישראל). Regenerate: node scripts/fetch-cities.mjs
import { writeFileSync } from "node:fs";

const RES = "9b17a3f4-8819-48cd-89db-22bea727fc3e";
const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${RES}&limit=2000`;

const res = await fetch(url);
if (!res.ok) {
  console.error("fetch failed:", res.status);
  process.exit(1);
}
const data = await res.json();

const names = [
  ...new Set(
    data.result.records
      .map((r) => String(r.Name_Hebrew ?? "").trim())
      .filter(Boolean)
  ),
].sort((a, b) => a.localeCompare(b, "he"));

const content =
  `// Official Israeli settlements — auto-generated from data.gov.il\n` +
  `// (מילון יישובים בישראל, resource ${RES}). Regenerate: node scripts/fetch-cities.mjs\n` +
  `export const CITIES: readonly string[] = ${JSON.stringify(names)};\n`;

writeFileSync("src/data/cities.ts", content, "utf8");
console.log(`wrote ${names.length} cities to src/data/cities.ts`);
