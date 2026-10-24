import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotAGoogleAccountError, copyDriveFile, driveFileMeta, ensureFolder, grantReadAccess, listFolderVideos, listSharedFolders, trashDriveFile, uploadToFolder } from "@/lib/drive-api";
import { driveFileId, isDriveFolder } from "@/lib/drive";
import { withPrevSurnames } from "@/lib/prev-surname";
import { CHALLENGES } from "@/app/hackathon-2026/shared";
import type { Json } from "@/types/database";

/**
 * The hackathon videos in the owner's Drive folder, shared PERSONALLY with
 * each judge of the challenge (the owner, 23/10: "הסרטונים צריכים להיות
 * מאוחסנים בדרייב עם שיתוף אישי כדי לעקוף חסימה של נטפרי"). The folder is one
 * she shared with the service account; the mirror copies every uploaded
 * video and every public Drive link a team pasted; YouTube links stay
 * embedded as they are.
 */
const FOLDER_KEY = "hackathon_drive_folder";
/** A Workspace user to act as (domain-wide delegation) - lets a My-Drive folder receive the uploads. Empty = the service account itself (shared drives only). */
const AS = () => process.env.GOOGLE_DRIVE_UPLOAD_AS?.trim() || undefined;

export interface DriveFolder {
  id: string;
  name: string;
}

export async function getDriveFolder(): Promise<DriveFolder | null> {
  try {
    const { data } = await createAdminClient().from("app_settings").select("value").eq("key", FOLDER_KEY).maybeSingle();
    const v = (data?.value ?? {}) as { id?: unknown; name?: unknown };
    return typeof v.id === "string" && v.id ? { id: v.id, name: typeof v.name === "string" ? v.name : v.id } : null;
  } catch {
    return null;
  }
}

export async function setDriveFolder(folder: DriveFolder | null): Promise<void> {
  const { error } = await createAdminClient()
    .from("app_settings")
    .upsert({ key: FOLDER_KEY, value: (folder ?? {}) as unknown as Json }, { onConflict: "key" });
  if (error) throw error;
}

export async function listDriveTargets() {
  return listSharedFolders(AS());
}

export interface DriveSyncResult {
  /** Submitted projects with a video that can be mirrored (an uploaded file or a Drive link). */
  total: number;
  /** Mirrored so far (after this pass). */
  done: number;
  mirrored: number;
  shared: number;
  remaining: number;
  errors: string[];
}

async function teamNames(teamKeys: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(teamKeys.flatMap((k) => k.split("+")))];
  if (!ids.length) return new Map();
  const { data } = await createAdminClient().from("profiles").select("id, full_name").in("id", ids);
  const nameOf = new Map((await withPrevSurnames(data ?? [])).map((p) => [p.id, p.full_name]));
  return new Map(teamKeys.map((k) => [k, k.split("+").map((id) => nameOf.get(id) ?? "צוות").join(" + ")]));
}

/** Safe for a Drive file name. */
const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);

/**
 * One pass, within a time budget: mirror the videos that are not in Drive
 * yet, then share every mirrored video with the judges of its challenge.
 * The admin button calls it again until `remaining` is 0.
 */
export async function syncVideosToDrive(budgetMs = 240_000): Promise<DriveSyncResult> {
  const started = Date.now();
  const folder = await getDriveFolder();
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("hackathon_submissions")
    .select("team_key, challenge_key, video_path, video_url, drive_file_id")
    .not("submitted_at", "is", null);
  const mirrorable = (subs ?? []).filter((s) => s.video_path || (s.video_url && driveFileId(s.video_url)));
  const fileSafeName = (challengeKey: string, team: string, ext: string) => `${fileSafe(CHALLENGES.find((c) => c.key === challengeKey)?.short ?? challengeKey)} - ${fileSafe(team)}.${ext}`;
  const pending = mirrorable.filter((s) => !s.drive_file_id);
  const errors: string[] = [];
  if (!folder) return { total: mirrorable.length, done: mirrorable.length - pending.length, mirrored: 0, shared: 0, remaining: pending.length, errors: ["לא נבחרה תיקייה בדרייב."] };
  const names = await teamNames(pending.map((s) => s.team_key));
  let mirrored = 0;
  for (const s of pending) {
    if (Date.now() - started > budgetMs) break;
    const team = names.get(s.team_key) ?? s.team_key.slice(0, 8);
    try {
      if (!s.video_path) {
        // A Drive link (a file, or a folder holding the video): copy INSIDE Drive - the service account reads what is
        // shared by link, and the copy belongs to the shared drive. No download, no size limit.
        const id = driveFileId(s.video_url ?? "");
        if (!id) throw new Error("קישור דרייב לא מזוהה");
        let src = isDriveFolder(s.video_url ?? "") ? (await listFolderVideos(id, AS()))[0] ?? null : await driveFileMeta(id, AS());
        if (src && !src.mimeType.startsWith("video/") && !/\.(mp4|mov|webm|m4v|mkv)$/i.test(src.name)) src = isDriveFolder(s.video_url ?? "") ? null : src;
        if (!src) throw new Error(isDriveFolder(s.video_url ?? "") ? "בתיקייה שבקישור אין סרטון, או שהיא לא פתוחה ״לכל מי שיש את הקישור״" : "הקישור לדרייב לא פתוח ״לכל מי שיש את הקישור״ - הצוות צריך לפתוח אותו");
        const ext = (src.name.match(/\.(mp4|mov|webm|m4v|mkv)$/i)?.[1] ?? (src.mimeType.includes("webm") ? "webm" : src.mimeType.includes("quicktime") ? "mov" : "mp4")).toLowerCase();
        const fileId = await copyDriveFile(src.id, folder.id, fileSafeName(s.challenge_key, team, ext), AS());
        await admin.from("hackathon_submissions").update({ drive_file_id: fileId }).eq("team_key", s.team_key);
        mirrored++;
        continue;
      }
      let mime = "video/mp4";
      let ext = "mp4";
      let bytes: Buffer;
      {
        const { data, error } = await admin.storage.from("hackathon").download(s.video_path);
        if (error || !data) throw new Error("הקובץ לא נמצא באחסון");
        bytes = Buffer.from(await data.arrayBuffer());
        mime = data.type && data.type !== "application/octet-stream" ? data.type : mime;
        ext = s.video_path.split(".").pop()?.toLowerCase() ?? ext;
      }
      if (bytes.length === 0) throw new Error("קובץ ריק");
      const fileId = await uploadToFolder(folder.id, fileSafeName(s.challenge_key, team, ext), mime, bytes, AS());
      await admin.from("hackathon_submissions").update({ drive_file_id: fileId }).eq("team_key", s.team_key);
      mirrored++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה";
      errors.push(`${team}: ${/storage quota/i.test(msg) ? "לחשבון השירות אין מקום אחסון - התיקייה צריכה להיות בכונן שיתופי (Shared Drive), או להגדיר GOOGLE_DRIVE_UPLOAD_AS" : msg}`);
    }
  }
  const share = await shareVideosWithJudges(Math.max(10_000, budgetMs - (Date.now() - started)));
  errors.push(...share.errors);
  const remaining = pending.length - mirrored - errors.filter((x) => !share.errors.includes(x)).length;
  return { total: mirrorable.length, done: mirrorable.length - pending.length + mirrored, mirrored, shared: share.shared, remaining: Math.max(0, remaining), errors };
}

/**
 * Every judge gets read access to the mirrored videos of the challenges she
 * was assigned to - never to the others. Idempotent through
 * hackathon_drive_shares; an unassigned judge gets nothing yet.
 */
export async function shareVideosWithJudges(budgetMs = 60_000): Promise<{ shared: number; errors: string[] }> {
  const started = Date.now();
  const admin = createAdminClient();
  const [{ data: judges }, { data: subs }, { data: done }] = await Promise.all([
    admin.from("hackathon_judges").select("profile_id, challenge_keys"),
    admin.from("hackathon_submissions").select("team_key, challenge_key, drive_file_id").not("drive_file_id", "is", null),
    admin.from("hackathon_drive_shares").select("drive_file_id, profile_id"),
  ]);
  if (!judges?.length || !subs?.length) return { shared: 0, errors: [] };
  const { data: mails } = await admin.rpc("member_emails", { p_ids: judges.map((j) => j.profile_id) });
  const emailOf = new Map(((mails ?? []) as { id: string; email: string | null }[]).map((m) => [m.id, m.email]));
  const had = new Set((done ?? []).map((d) => `${d.drive_file_id}|${d.profile_id}`));
  const errors: string[] = [];
  let shared = 0;
  for (const j of judges) {
    const email = emailOf.get(j.profile_id);
    const keys = j.challenge_keys ?? [];
    if (!email || keys.length === 0) continue;
    for (const s of subs) {
      if (!s.drive_file_id || !keys.includes(s.challenge_key) || had.has(`${s.drive_file_id}|${j.profile_id}`)) continue;
      if (Date.now() - started > budgetMs) return { shared, errors };
      try {
        await grantReadAccess(s.drive_file_id, email, AS());
        await admin.from("hackathon_drive_shares").insert({ drive_file_id: s.drive_file_id, profile_id: j.profile_id });
        had.add(`${s.drive_file_id}|${j.profile_id}`);
        shared++;
      } catch (e) {
        if (e instanceof NotAGoogleAccountError) {
          errors.push(`${email}: לא חשבון גוגל - אי אפשר לשתף אישית (היא תראה את הנגן הישיר)`);
          break;
        }
        errors.push(`${email}: ${e instanceof Error ? e.message.slice(0, 120) : "שגיאה"}`);
        break;
      }
    }
  }
  return { shared, errors };
}

/**
 * The catalogue pictures folder (the owner, 23/10): "קטלוג הפרויקטים - תמונות"
 * inside the hackathon shared drive (the configured target, or an explicit
 * parent). Remembered in app_settings so later uploads land in the same place.
 */
const CATALOG_KEY = "hackathon_catalog_folder";
export async function ensureCatalogFolder(parentId: string | null): Promise<DriveFolder> {
  const admin = createAdminClient();
  const { data } = await admin.from("app_settings").select("value").eq("key", CATALOG_KEY).maybeSingle();
  const v = (data?.value ?? {}) as { id?: unknown; name?: unknown; parent?: unknown };
  if (typeof v.id === "string" && v.id && (!parentId || v.parent === parentId)) return { id: v.id, name: typeof v.name === "string" ? v.name : "קטלוג הפרויקטים - תמונות" };
  const parent = parentId ?? (await getDriveFolder())?.id;
  if (!parent) throw new Error("לא נבחר יעד בדרייב.");
  const name = "קטלוג הפרויקטים - תמונות";
  const id = await ensureFolder(parent, name, AS());
  await admin.from("app_settings").upsert({ key: CATALOG_KEY, value: { id, name, parent } as unknown as Json }, { onConflict: "key" });
  return { id, name };
}

export async function uploadCatalogImage(folderId: string, name: string, mime: string, bytes: Buffer): Promise<string> {
  return uploadToFolder(folderId, name, mime, bytes, AS());
}

/** Undo one mirror (a test, a wrong file): trash the Drive copy and forget it. */
export async function unmirrorVideo(teamKey: string): Promise<void> {
  const admin = createAdminClient();
  const { data: s } = await admin.from("hackathon_submissions").select("drive_file_id").eq("team_key", teamKey).maybeSingle();
  if (!s?.drive_file_id) return;
  await trashDriveFile(s.drive_file_id, AS());
  await admin.from("hackathon_drive_shares").delete().eq("drive_file_id", s.drive_file_id);
  await admin.from("hackathon_submissions").update({ drive_file_id: null }).eq("team_key", teamKey);
}
