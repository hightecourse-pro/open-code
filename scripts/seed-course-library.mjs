// Seed the recorded-courses library from course-library.json (extracted from
// the owner's Excel). One course per Excel code; each row becomes a unit
// (קוביה) with its recordings and materials folder as content_links — which
// puts them under the automatic Drive-sharing machinery.
//
// Requires supabase/_course_library.sql to have run first. Idempotent:
// re-running replaces each seeded course's units and links.
//
// Usage: node scripts/seed-course-library.mjs
import { guardTarget } from "./_guard.mjs";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "@supabase/supabase-js";


guardTarget();
const HERE = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(HERE, "..", ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const units = JSON.parse(readFileSync(join(HERE, "course-library.json"), "utf8"));

// Course-level titles where the year cycles are named differently.
const TITLE_BY_CODE = {
  3: "אנגולר מתקדמים",
  8: "AI למנהלים ולמנתחי מערכות",
  11: ".Net",
};
const CATEGORY_BY_CODE = {
  1: "אוטומציה", 2: "Frontend", 3: "Frontend", 4: "ארכיטקטורה", 5: "Salesforce",
  6: "ניהול מוצר", 7: "ניתוח מערכות", 8: "AI", 9: "AI", 10: "AI",
  11: ".NET", 12: ".NET", 13: "Frontend", 14: "Salesforce", 15: "UI/UX",
};

const byCode = new Map();
for (const u of units) {
  const arr = byCode.get(u.code) ?? [];
  arr.push(u);
  byCode.set(u.code, arr);
}

for (const [code, list] of [...byCode.entries()].sort((a, b) => a[0] - b[0])) {
  list.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  const names = [...new Set(list.map((u) => u.name))];
  const title = names.length === 1 ? names[0] : (TITLE_BY_CODE[code] ?? names[names.length - 1]);
  const totalVideos = list.reduce((n, u) => n + u.videos.length, 0);

  // course row — keyed by code
  const { data: existing } = await db.from("courses").select("id").eq("code", code).maybeSingle();
  const courseFields = {
    title,
    code,
    category: CATEGORY_BY_CODE[code] ?? null,
    lessons_count: totalVideos,
    duration_hours: Math.round(totalVideos * 1.5),
    cover_variant: ((code - 1) % 6) + 1,
    is_published: true,
  };
  let courseId;
  if (existing) {
    const { error } = await db.from("courses").update(courseFields).eq("id", existing.id);
    if (error) throw new Error(`course ${code} update: ${error.message}`);
    courseId = existing.id;
  } else {
    const { data, error } = await db.from("courses").insert(courseFields).select("id").single();
    if (error) throw new Error(`course ${code} insert: ${error.message}`);
    courseId = data.id;
  }

  // replace units (FK cascade also clears their content_links)
  const { error: delErr } = await db.from("course_units").delete().eq("course_id", courseId);
  if (delErr) throw new Error(`course ${code} clear units: ${delErr.message}`);

  let unitSort = 0;
  let linkCount = 0;
  for (const u of list) {
    const { data: unit, error: uErr } = await db
      .from("course_units")
      .insert({ course_id: courseId, name: u.name, year: u.year || null, sort_order: unitSort++ })
      .select("id")
      .single();
    if (uErr) throw new Error(`unit ${u.name}: ${uErr.message}`);

    const links = [
      ...u.videos.map((url, i) => ({
        owner_type: "course", owner_id: courseId, unit_id: unit.id,
        kind: "video", title: `שיעור ${i + 1}`, url, sort_order: i,
      })),
      ...u.materials.map((url, i) => ({
        owner_type: "course", owner_id: courseId, unit_id: unit.id,
        kind: "materials", title: "חומרי עזר להורדה", url, sort_order: 100 + i,
      })),
    ];
    if (links.length) {
      const { error: lErr } = await db.from("content_links").insert(links);
      if (lErr) throw new Error(`links for ${u.name}: ${lErr.message}`);
      linkCount += links.length;
    }
  }
  console.log(`ok: [${code}] ${title} — ${list.length} units, ${linkCount} links`);
}
console.log("\nCOURSE LIBRARY SEEDED");
