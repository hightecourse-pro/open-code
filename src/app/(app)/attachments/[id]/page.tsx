import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { netfreeSafeUrl } from "@/lib/netfree";
import { IMAGE_MIMES } from "@/lib/attachments";
import { DocxViewer } from "@/components/patterns/docx-viewer";

export const metadata: Metadata = { title: "צפייה בקובץ" };
export const dynamic = "force-dynamic";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const fmtSize = (b: number) =>
  b >= 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`;

/**
 * One attachment SHOWN in the page instead of downloaded (מלכי ארנסט, 20/10:
 * "בעבודה חסום לי הורדה"): images and PDFs inline, Word rendered in the
 * browser. RLS on `attachments` decides who may open it - her own files, a
 * thread she takes part in, a forum post as a member, or the team - so a row
 * she may not see is simply a 404.
 */
export default async function AttachmentViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const supabase = await createClient();
  const { data: a } = await supabase
    .from("attachments")
    .select("id, file_path, file_name, mime, size_bytes")
    .eq("id", id)
    .maybeSingle();
  if (!a) notFound();

  const { data: signed } = await createAdminClient()
    .storage.from("attachments")
    .createSignedUrl(a.file_path, 60 * 60);
  if (!signed?.signedUrl) notFound();
  const viewUrl = netfreeSafeUrl(signed.signedUrl);
  const downloadUrl = netfreeSafeUrl(signed.signedUrl, { download: a.file_name });
  const kind = IMAGE_MIMES.includes(a.mime)
    ? "image"
    : a.mime === "application/pdf"
      ? "pdf"
      : a.mime === DOCX_MIME
        ? "docx"
        : "other";

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap bg-white border border-ink-200 rounded-[18px] px-4 py-3 shadow-sm">
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-bold text-[16px] text-ink-1000 truncate" dir="ltr">
            {a.file_name}
          </h1>
          <div className="text-[12px] text-ink-500">{fmtSize(a.size_bytes)}</div>
        </div>
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink-600 border border-ink-200 rounded-full px-3 py-1.5 hover:border-brand-purple hover:text-brand-purple"
          data-testid="attachment-open-raw"
        >
          <ExternalLink size={14} /> פתיחה בטאב חדש
        </a>
        <a
          href={downloadUrl}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-white bg-brand-pink-deep rounded-full px-3 py-1.5 hover:bg-brand-purple"
          data-testid="attachment-download"
        >
          <Download size={14} /> הורדה
        </a>
      </div>

      {kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL
        <img
          src={viewUrl}
          alt={a.file_name}
          className="max-w-full mx-auto rounded-xl border border-ink-200 bg-white"
          data-testid="attachment-image"
        />
      )}
      {kind === "pdf" && (
        <iframe
          src={viewUrl}
          title={a.file_name}
          className="w-full h-[82dvh] rounded-xl border border-ink-200 bg-white"
          data-testid="attachment-pdf"
        />
      )}
      {kind === "docx" && <DocxViewer url={viewUrl} />}
      {kind === "other" && (
        <div className="bg-white border border-ink-200 rounded-[18px] p-6 text-[14px] text-ink-700">
          לקובץ מסוג זה אין תצוגה בדפדפן - אפשר להוריד אותו בכפתור למעלה.
        </div>
      )}
    </div>
  );
}
