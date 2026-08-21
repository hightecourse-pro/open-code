"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { FileText, ImageIcon, Loader2, Paperclip, X } from "lucide-react";
import { uploadAttachment, removeUnlinkedAttachment, type UploadedAttachment } from "@/app/(app)/attachments/actions";

/**
 * Attach files to whatever is being composed: a paperclip button, and paste —
 * an image pasted anywhere inside `children` (the editor) uploads too. Each
 * uploaded file becomes a chip with a remove ×, and a hidden attach_ids input
 * the send action reads to link the files to the new post/comment/message.
 */
export function AttachmentPicker({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<UploadedAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function uploadFiles(files: FileList | File[]) {
    setError(null);
    for (const file of Array.from(files).slice(0, 5)) {
      startUpload(async () => {
        const fd = new FormData();
        fd.append("file", file);
        const res = await uploadAttachment(fd);
        if (res.ok) setItems((prev) => [...prev, res.attachment]);
        else setError(res.error);
      });
    }
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    // Fire and forget — the nightly sweep is the safety net anyway.
    void removeUnlinkedAttachment(id);
  }

  const fmtSize = (b: number) =>
    b >= 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`;

  return (
    <div
      onPaste={(e) => {
        const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (files.length) {
          e.preventDefault();
          uploadFiles(files);
        }
      }}
      className="flex flex-col gap-1.5"
    >
      {children}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="צירוף קובץ או תמונה"
          aria-label="צירוף קובץ או תמונה"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-brand-purple transition-colors cursor-pointer"
        >
          <Paperclip size={13} /> צירוף קובץ
          <span className="text-ink-300">· או הדביקי תמונה ישר לתיבה</span>
        </button>
        {uploading && <Loader2 size={13} className="animate-spin text-brand-purple" />}
        {error && <span className="text-[12px] text-danger">{error}</span>}
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 bg-ink-50 border border-ink-200 rounded-lg px-2 py-1 max-w-[240px]"
            >
              <input type="hidden" name="attach_ids" value={a.id} />
              {a.isImage && a.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL
                <img src={a.previewUrl} alt="" className="w-8 h-8 rounded object-cover" />
              ) : a.isImage ? (
                <ImageIcon size={14} className="text-brand-purple shrink-0" />
              ) : (
                <FileText size={14} className="text-brand-purple shrink-0" />
              )}
              <span className="text-[11.5px] text-ink-700 truncate" dir="ltr">
                {a.fileName}
              </span>
              <span className="text-[10.5px] text-ink-400">{fmtSize(a.sizeBytes)}</span>
              <button
                type="button"
                aria-label={`הסרת ${a.fileName}`}
                onClick={() => remove(a.id)}
                className="text-ink-400 hover:text-danger cursor-pointer"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
