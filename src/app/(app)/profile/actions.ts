"use server";

import { revalidatePath } from "next/cache";
import { claimExternalPaymentsFor } from "@/lib/payments/external";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FIELD_VALIDATORS } from "@/lib/validators";
import { DEFAULT_LANGUAGES, LANGUAGE_SKILLS_KEY, LANG_LEVELS } from "@/lib/language-skills";
import {
  EXPERIENCE_KEYS,
  PRACTICAL_EXPERIENCE_KEY,
  PRACTICUM_PERIOD_KEY,
  isCompleteExperienceEntry,
  isValidYm,
  parseExperienceEntries,
  parsePracticumPeriod,
  type ExperienceEntry,
} from "@/lib/experience-entries";
import { repointSharesToNewEmail } from "@/lib/drive-shares";
import type { Database, Json, QuestionScope } from "@/types/database";

export type ProfileState = { ok?: boolean; error?: string };

/** Set the member's daily-digest email preference. */
export async function setDigestFrequency(freq: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const valid = ["daily", "unread", "off"].includes(freq) ? freq : "daily";
  await supabase.from("profiles").update({ digest_frequency: valid }).eq("id", user.id);
  revalidatePath("/profile");
}

/** Show or hide her profile in the employer portal. */
export async function setPortalListed(listed: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ portal_listed: listed }).eq("id", user.id);
  revalidatePath("/profile");
}

export type DriveEmailState = { ok?: boolean; error?: string };

/**
 * The Google address we share the community's Drive material with. Saving one
 * clears the "we asked you" flag so the sync worker picks her up again.
 */
export async function setDriveEmail(
  _prev: DriveEmailState,
  formData: FormData
): Promise<DriveEmailState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "תצטרכי להתחבר מחדש." };

  const email = String(formData.get("drive_email") ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "הכתובת לא נראית תקינה. בדקי אותה שוב 🙂" };
  }

  const { error } = await supabase.from("member_private").upsert(
    { profile_id: user.id, drive_email: email || null, drive_email_requested_at: null },
    { onConflict: "profile_id" }
  );
  if (error) return { error: "לא הצלחנו לשמור כרגע. בואי ננסה שוב." };

  // Material already shared with her previous address has to move to the new
  // one: reopening the rows makes the sync worker un-share the old address
  // and grant the new one.
  await repointSharesToNewEmail(user.id);

  revalidatePath("/profile");
  return { ok: true };
}

export type EmploymentState = { ok?: boolean; error?: string };

/**
 * "מצאתי עבודה" — the member updates her own employment status. hired_at is
 * stamped only on the false→true transition (so the celebration window is
 * honest), workplace clears when she turns it off, and hired_via_us is
 * pipeline-owned — never touched here.
 */
export async function updateEmployment(
  _prev: EmploymentState,
  formData: FormData
): Promise<EmploymentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "תצטרכי להתחבר מחדש." };

  const foundJob = formData.get("found_job") === "on";
  const workplace = String(formData.get("workplace") ?? "").trim().slice(0, 200);

  const { data: before } = await supabase
    .from("profiles")
    .select("found_job")
    .eq("id", user.id)
    .single();

  const update: { found_job: boolean; hired_at?: string } = { found_job: foundJob };
  if (foundJob && !before?.found_job) update.hired_at = new Date().toISOString();

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    // Same warm message for both writes — the log is what tells them apart.
    console.error("[employment] found_job write failed:", error);
    return { error: "לא הצלחנו לשמור כרגע. בואי ננסה שוב." };
  }

  // Where she works stays between her and the team — member_private, never the
  // profile row the whole community can read.
  const { error: wpError } = await supabase.from("member_private").upsert(
    {
      profile_id: user.id,
      workplace: foundJob ? workplace || null : null,
      // member_private has no set_updated_at trigger, so on the UPDATE branch
      // of the upsert the stamp would keep its original insert value forever.
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );
  if (wpError) {
    // Log the Postgres error itself (never the workplace value — on an internal
    // job that string IS the hiring client's name) so a schema/permission
    // failure is diagnosable instead of just "לא הצלחנו לשמור".
    console.error("[employment] workplace write failed:", wpError);
    return { error: "לא הצלחנו לשמור כרגע. בואי ננסה שוב." };
  }

  revalidatePath("/profile");
  revalidatePath("/forum"); // the hired-celebration banner lives there
  return { ok: true };
}

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  if (firstName.length < 1 || lastName.length < 1) {
    return { error: "נשמח לדעת איך קוראים לך 🙂 (שם פרטי ושם משפחה)" };
  }
  const fullName = `${firstName} ${lastName}`.trim();

  // Was this the first-login mandatory completion?
  const { data: before } = await supabase
    .from("profiles")
    .select("profile_completed, role")
    .eq("id", user.id)
    .single();
  const firstCompletion = !before?.profile_completed;

  // Validate against the SAME question set the member actually sees (scope by
  // role) — otherwise hidden questions block saving with "missing" errors.
  const scope: QuestionScope[] = before?.role === "mentor" ? ["all", "mentor"] : ["all", "junior"];
  const { data: questions } = await supabase
    .from("config_questions")
    .select("id, key, label_he, field_type, required, depends_on, intake_track, active")
    .in("scope", scope)
    // Active questions, plus the structural experience gate even if toggled off.
    .or("active.eq.true,key.eq.has_experience");

  // Resolve each answer (handling "אחר" free-text), and validate required ones.
  const answered: { question_id: string; value: Json }[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];
  const boolByKey = new Map<string, boolean>();
  for (const q of questions ?? []) {
    if (q.field_type === "bool") {
      boolByKey.set(q.key, formData.get(`q_${q.id}`) === "on");
    }
  }
  const hasExperience = boolByKey.get("has_experience") ?? false;

  for (const q of questions ?? []) {
    const key = `q_${q.id}`;
    // Skip questions hidden by the experience track — don't require/store them.
    if (q.intake_track === "junior" && hasExperience) continue;
    if (q.intake_track === "experienced" && !hasExperience) continue;
    // Skip conditional follow-ups whose parent bool is off — don't require them.
    if (q.depends_on && !boolByKey.get(q.depends_on)) continue;

    let value: Json;
    let empty = false;

    if (q.key === LANGUAGE_SKILLS_KEY) {
      // Matrix rows: paired __lang / __level inputs; keep only leveled rows.
      const langs = formData.getAll(`${key}__lang`).map(String);
      const levels = formData.getAll(`${key}__level`).map(String);
      const seenLangs = new Set<string>();
      const skills = langs
        .map((lang, i) => ({ lang: lang.trim(), level: (levels[i] ?? "").trim() }))
        // Only known levels, one entry per language.
        .filter((s) => {
          if (!s.lang || !LANG_LEVELS.some((l) => l.value === s.level)) return false;
          if (seenLangs.has(s.lang)) return false;
          seenLangs.add(s.lang);
          return true;
        });
      value = skills as unknown as Json;
      // עברית ואנגלית must each be rated when the question is required.
      if (q.required && !DEFAULT_LANGUAGES.every((l) => skills.some((s) => s.lang === l))) {
        missing.push(`${q.label_he} (עברית ואנגלית)`);
      }
      answered.push({ question_id: q.id, value });
      continue;
    }

    // Experience lists (practical_experience / work_history): a JSON array of
    // entries from the wizard's list editor. Every ADDED entry must be
    // complete; work_history (required) needs at least one entry.
    if (EXPERIENCE_KEYS.has(q.key)) {
      let entries: ExperienceEntry[] = [];
      try {
        entries = parseExperienceEntries(JSON.parse(String(formData.get(key) || "[]")));
      } catch {
        entries = [];
      }
      // Only one work_history entry may be "מקום נוכחי/אחרון".
      let seenCurrent = false;
      entries = entries.map((e) => {
        if (!e.current) return e;
        if (seenCurrent) return { ...e, current: undefined };
        seenCurrent = true;
        return e;
      });
      const requireKind = q.key === PRACTICAL_EXPERIENCE_KEY;
      if (entries.some((e) => !isCompleteExperienceEntry(e, requireKind))) {
        invalid.push(
          requireKind
            ? "בכל התנסות שהוספת צריך למלא סוג, מקום, תיאור ותאריכי התחלה וסיום 🙂"
            : "בכל מקום עבודה שהוספת צריך למלא מקום, תיאור ותאריכי התחלה וסיום 🙂"
        );
      }
      if (q.required && entries.length === 0) missing.push(q.label_he);
      answered.push({ question_id: q.id, value: entries as unknown as Json });
      continue;
    }

    // practicum_period: one {"start","end"} object from the wizard's period
    // picker. It only reaches here when practicum_done is on (the depends_on
    // skip above), so an unanswered practicum never blocks the save.
    if (q.key === PRACTICUM_PERIOD_KEY) {
      let raw: unknown = null;
      try {
        raw = JSON.parse(String(formData.get(key) || "null"));
      } catch {
        raw = null;
      }
      const p = parsePracticumPeriod(raw);
      if (!p.start && !p.end) {
        if (q.required) missing.push(q.label_he);
      } else if (!isValidYm(p.start)) {
        invalid.push("סמני מתי התחלת את הפרקטיקום — ואם עוד לא סיימת, סמני את זה 🙂");
      } else if (p.end !== "current" && !isValidYm(p.end)) {
        invalid.push("סמני גם מתי הסתיים הפרקטיקום — או סמני \"עוד לא סיימתי\" 🙂");
      } else if (p.end !== "current" && p.end < p.start) {
        invalid.push("רגע, תאריך סיום הפרקטיקום יוצא לפני ההתחלה — בדקי שוב את התאריכים 🙂");
      }
      answered.push({ question_id: q.id, value: { start: p.start, end: p.end } });
      continue;
    }

    if (q.field_type === "multiselect" || q.field_type === "tags") {
      let values = formData.getAll(key).map(String);
      if (values.includes("other")) {
        const other = String(formData.get(`${key}__other`) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        values = values.filter((v) => v !== "other").concat(other);
      }
      value = values;
      empty = values.length === 0;
    } else if (q.field_type === "number") {
      const raw = formData.get(key);
      const n = Number(raw);
      value = raw === null || raw === "" || !Number.isFinite(n) ? null : n;
      empty = value === null;
    } else if (q.field_type === "bool") {
      value = boolByKey.get(q.key) ?? false;
      empty = false; // a "no" is a valid answer
    } else if (q.field_type === "select") {
      let v = String(formData.get(key) ?? "");
      if (v === "other") v = String(formData.get(`${key}__other`) ?? "").trim();
      value = v;
      empty = v === "";
    } else {
      const v = String(formData.get(key) ?? "").trim();
      value = v;
      empty = v === "";
    }

    if (q.required && empty) missing.push(q.label_he);
    const check = FIELD_VALIDATORS[q.key];
    if (check && typeof value === "string") {
      const msg = check(value);
      if (msg) invalid.push(msg);
    }
    answered.push({ question_id: q.id, value });
  }

  if (invalid.length > 0) {
    return { error: invalid.join(" · ") };
  }
  // Staff accounts aren't community members — don't hold their save hostage
  // on member-intake required fields.
  if (missing.length > 0 && before?.role !== "admin") {
    return { error: `כמעט סיימנו 🙂 נשארו כמה שדות חובה: ${missing.slice(0, 6).join(", ")}` };
  }

  // The PM's rule: a member profile is not complete without at least one CV.
  // A file handed in with the wizard lands in her documents like any other
  // upload; mentors and staff are exempt — they don't job-hunt.
  if (before?.role !== "admin" && before?.role !== "mentor") {
    const { count: cvCount } = await supabase
      .from("cv_documents")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id);
    if ((cvCount ?? 0) === 0) {
      const cvFile = formData.get("cv_file");
      if (!(cvFile instanceof File) || cvFile.size === 0) {
        return { error: "כמעט סיימנו 🙂 חסר רק קובץ קורות חיים — העלי אחד בשלב האחרון של השאלון." };
      }
      if (cvFile.size > 10 * 1024 * 1024) return { error: "קובץ קורות החיים גדול מדי — עד 10MB." };
      if (!/\.(pdf|docx?)$/i.test(cvFile.name)) {
        return { error: "קורות חיים אפשר להעלות רק כ-PDF או Word (doc/docx)." };
      }
      const safeName = cvFile.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("cvs")
        .upload(path, cvFile, { contentType: cvFile.type || "application/octet-stream", upsert: false });
      if (upErr) return { error: "העלאת קורות החיים נכשלה. נסי שוב." };
      const row = { profile_id: user.id, label: cvFile.name, language: "he" as const, file_path: path, file_name: cvFile.name };
      // Her first document becomes the default; pre-migration DBs lack the
      // column (42703) — retry without it, same as /cv does.
      let { error: docErr } = await supabase.from("cv_documents").insert({ ...row, is_default: true });
      if (docErr) ({ error: docErr } = await supabase.from("cv_documents").insert(row));
      if (docErr) return { error: "קורות החיים עלו אבל לא נשמרו. נסי שוב." };
    }
  }

  await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      avatar_initials: firstName.slice(0, 1),
      is_experienced: hasExperience,
      profile_completed: true,
    })
    .eq("id", user.id);

  // Change-tracked save: one read of what's already stored, then upserts only
  // for answers whose value actually changed (or is brand new) — so a row's
  // updated_at honestly means "when this answer last changed", not "when she
  // last hit save".
  const { data: storedRows } = await supabase
    .from("profile_answers")
    .select("question_id, value")
    .eq("profile_id", user.id);
  const stored = new Map((storedRows ?? []).map((r) => [r.question_id, r.value]));

  const savedAt = new Date().toISOString();
  // Every one of these used to be fired and forgotten. A failure — a policy, a
  // constraint, a dropped connection — left the profile marked "completed" with
  // the answers missing, and told her it had been saved. Nothing about that is
  // recoverable after the fact, so a failure has to stop and say so.
  const failures: string[] = [];
  for (const a of answered) {
    if (stored.has(a.question_id) && stableJson(stored.get(a.question_id)) === stableJson(a.value)) {
      continue; // unchanged — leave the row (and its updated_at) alone
    }
    // The updated_at column exists on the table (its Row type carries it) but
    // the hand-written Insert type omits DB-defaulted timestamps — cast through
    // the Insert shape so the explicit change stamp still reaches the row.
    const payload = {
      profile_id: user.id,
      question_id: a.question_id,
      value: a.value,
      updated_at: savedAt,
    };
    const { error: saveError } = await supabase
      .from("profile_answers")
      .upsert(payload as Database["public"]["Tables"]["profile_answers"]["Insert"], {
        onConflict: "profile_id,question_id",
      });
    if (saveError) failures.push(`${a.question_id}: ${saveError.message}`);
  }

  if (failures.length > 0) {
    // Put the profile back the way it was, so she is not locked out of the
    // questionnaire believing it is done while her answers are not stored.
    if (firstCompletion) {
      await supabase.from("profiles").update({ profile_completed: false }).eq("id", user.id);
    }
    console.error(
      `[profile] ${failures.length}/${answered.length} answers failed to save for ${user.id}:`,
      failures.slice(0, 5).join(" | ")
    );
    return {
      error:
        failures.length === answered.length
          ? "לא הצלחנו לשמור את התשובות שלך. בבקשה נסי שוב — ואם זה חוזר, כתבי לנו ונטפל בזה."
          : `חלק מהתשובות לא נשמרו (${failures.length} מתוך ${answered.length}). בבקשה נסי לשמור שוב.`,
    };
  }

  revalidatePath("/profile");
  // On first completion, the natural next step is the membership decision —
  // pay, or apply as a mentor (the PM's call): /join offers both. A member
  // who is already active just lands in the community.
  if (firstCompletion) {
    // She may have already paid OUTSIDE the app (a direct Nedarim link) —
    // claim that payment by her email before deciding where she lands.
    try {
      await claimExternalPaymentsFor(user.id, user.email);
    } catch (e) {
      console.error("[profile] external payment claim failed:", e);
    }
    const { data: after } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();
    redirect(after?.status === "active" ? "/forum" : "/join");
  }
  return { ok: true };
}

/**
 * Deterministic JSON for change detection: object keys are sorted (Postgres
 * jsonb reorders them, so a naive stringify would see phantom changes) and
 * undefined is handled the way JSON.stringify serializes it (dropped in
 * objects, null in arrays).
 */
function stableJson(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) {
    return `[${v.map((item) => stableJson(item === undefined ? null : item)).join(",")}]`;
  }
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`).join(",")}}`;
}
