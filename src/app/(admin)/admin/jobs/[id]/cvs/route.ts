// Bulk CV download for a job's final-approved applicants (the owner, 8/9:
// "אני רוצה אפשרות להוריד את כל קורות החיים שלהן אליי למחשב").
//
// One click hands the admin a ZIP of every CV belonging to applicants she
// marked "אישור סופי" on this job. Each applicant contributes the CV she
// attached to THIS application when there is one (she tailored it), else her
// newest CV (Hebrew first) - the same preference order the portal uses.
import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Fetching a dozen files from storage can take a moment.
export const maxDuration = 120;

/** Windows-safe file name out of a member's display name. */
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim() || "מועמדת";
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id: jobId } = await ctx.params;
  const admin = createAdminClient();

  const { data: job } = await admin.from("jobs").select("id, title").eq("id", jobId).maybeSingle();
  if (!job) return new NextResponse(null, { status: 404 });

  const { data: apps } = await admin
    .from("applications")
    .select("applicant_id, cv_document_id")
    .eq("job_id", jobId)
    .eq("admin_mark", "approved");
  if (!apps?.length) {
    return new NextResponse("אין מועמדות עם אישור סופי במשרה הזו.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const applicantIds = [...new Set(apps.map((a) => a.applicant_id))];
  const [{ data: profiles }, { data: docs }] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", applicantIds),
    admin
      .from("cv_documents")
      .select("id, profile_id, file_path, language, created_at")
      .in("profile_id", applicantIds)
      .order("created_at", { ascending: false }),
  ]);
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name || "מועמדת"]));
  const docById = new Map((docs ?? []).map((d) => [d.id, d]));
  const docsOf = new Map<string, { file_path: string; language: string | null }[]>();
  for (const d of docs ?? []) {
    const l = docsOf.get(d.profile_id) ?? [];
    l.push(d);
    docsOf.set(d.profile_id, l);
  }

  const zip = new JSZip();
  const missing: string[] = [];
  const used = new Set<string>();

  for (const app of apps) {
    const name = safeName(nameOf.get(app.applicant_id) ?? "מועמדת");
    // The application's own CV first (ownership re-checked via profile_id),
    // else newest Hebrew, else newest anything.
    const attached = app.cv_document_id ? docById.get(app.cv_document_id) : undefined;
    const own = attached && attached.profile_id === app.applicant_id ? attached : undefined;
    const fallback = docsOf.get(app.applicant_id) ?? [];
    const doc = own ?? fallback.find((d) => d.language === "he") ?? fallback[0];
    if (!doc) {
      missing.push(name);
      continue;
    }

    const { data: blob, error } = await admin.storage.from("cvs").download(doc.file_path);
    if (error || !blob) {
      missing.push(`${name} (הקובץ לא נמצא באחסון)`);
      continue;
    }

    const ext = doc.file_path.includes(".") ? doc.file_path.slice(doc.file_path.lastIndexOf(".")) : ".pdf";
    let fileName = `${name}${ext}`;
    for (let n = 2; used.has(fileName); n++) fileName = `${name} (${n})${ext}`;
    used.add(fileName);
    zip.file(fileName, await blob.arrayBuffer());
  }

  if (used.size === 0) {
    return new NextResponse("לאף אחת מהמאושרות אין קובץ קורות חיים שמור.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (missing.length) {
    zip.file(
      "חסרות קורות חיים.txt",
      "למועמדות הבאות לא נמצא קובץ קורות חיים:\r\n" + missing.map((m) => `- ${m}`).join("\r\n")
    );
  }

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const zipName = `קורות חיים - ${safeName(job.title)}.zip`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
