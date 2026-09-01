"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { sendWhatsAppMedia, sendWhatsAppReply, startTemplateConversation } from "./actions";

export interface WaContactRow {
  id: string;
  waId: string;
  name: string;
  isMember: boolean;
  lastMessageAt: string | null;
  windowLeftMs: number;
}

export interface WaMessageRow {
  id: string;
  direction: "in" | "out";
  body: string;
  status: string;
  error: string | null;
  created_at: string;
  kind: string;
  media_path: string | null;
  media_mime: string | null;
  filename: string | null;
  /** Signed, short-lived — generated server-side per render. */
  mediaUrl: string | null;
}

export interface WaMemberOption {
  name: string;
  waId: string;
}

export interface WaTemplateOption {
  name: string;
  bodyText: string;
  paramCount: number;
  status: string;
}

/**
 * Recordings ALWAYS re-encode to MP3 in the browser (decode → PCM → lamejs).
 * MediaRecorder output is never trusted: Chrome's webm is refused outright,
 * and its audio/mp4 is FRAGMENTED mp4 that Meta accepts and then fails with
 * "Media upload error" (the owner, 1/9, three times). Only hand-attached
 * files pass through by mime.
 */
async function toWhatsAppAudio(file: File, opts?: { passthrough?: boolean }): Promise<File> {
  const base = file.type.split(";")[0];
  if (opts?.passthrough && ["audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac", "audio/amr"].includes(base))
    return file;
  const mod = (await import("lamejs")) as { default?: { Mp3Encoder: new (ch: number, rate: number, kbps: number) => { encodeBuffer: (s: Int16Array) => Int8Array; flush: () => Int8Array } } } & Record<string, unknown>;
  const L = (mod.default ?? mod) as { Mp3Encoder: new (ch: number, rate: number, kbps: number) => { encodeBuffer: (s: Int16Array) => Int8Array; flush: () => Int8Array } };
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  void ctx.close();
  const ch = decoded.getChannelData(0);
  const samples = new Int16Array(ch.length);
  for (let i = 0; i < ch.length; i++) {
    const s = Math.max(-1, Math.min(1, ch[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const enc = new L.Mp3Encoder(1, decoded.sampleRate, 64);
  const chunks: Uint8Array[] = [];
  const FRAME = 1152;
  for (let i = 0; i < samples.length; i += FRAME) {
    const d = enc.encodeBuffer(samples.subarray(i, i + FRAME));
    if (d.length) chunks.push(new Uint8Array(d));
  }
  const tail = enc.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));
  return new File([new Blob(chunks as BlobPart[], { type: "audio/mpeg" })], "voice-note.mp3", { type: "audio/mpeg" });
}

const TIME_IL = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

function windowChip(ms: number): { label: string; open: boolean } {
  if (ms <= 0) return { label: "חלון המענה סגור", open: false };
  const h = Math.floor(ms / 3_600_000);
  return { label: h >= 1 ? `עוד ${h} שע׳ לחלון המענה` : "פחות משעה לחלון המענה", open: true };
}

const STATUS_HE: Record<string, string> = {
  sent: "נשלח",
  delivered: "נמסר",
  read: "נקרא ✓✓",
  failed: "נכשל",
};

/** WhatsApp-ish everyday emojis — inserted into the composer at the caret. */
const EMOJIS = [
  "😊", "😂", "🤣", "❤️", "💜", "🙏", "👍", "👏", "🎉", "✨",
  "😍", "🥰", "😉", "🤗", "😅", "🙈", "💪", "🔥", "🌸", "☀️",
  "😢", "😮", "🤔", "👌", "🫶", "💐", "🎊", "🥳", "📌", "✅",
];

/** URLs become clickable — a chat without live links isn't a chat. */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="underline break-all" dir="ltr">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function MediaBubble({ m }: { m: WaMessageRow }) {
  if (!m.mediaUrl) return null;
  if (m.kind === "image" || m.kind === "sticker") {
    return (
      <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer">
        <img src={m.mediaUrl} alt="" className={cn("rounded-lg max-h-64 max-w-full", m.kind === "sticker" && "max-h-28")} />
      </a>
    );
  }
  if (m.kind === "video") {
    return <video src={m.mediaUrl} controls className="rounded-lg max-h-64 max-w-full" />;
  }
  if (m.kind === "audio") {
    return <audio src={m.mediaUrl} controls className="max-w-[240px]" />;
  }
  return (
    <a
      href={m.mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 underline font-semibold"
    >
      📎 {m.filename ?? "קובץ להורדה"}
    </a>
  );
}

/** Our four templates share one param convention — friendly labels + smart
 *  defaults come from it (the owner, 1/9). */
const OUR_PARAM_LABELS = ["שם הנמענת", "השם שלך", "תוכן ההודעה"];
const OUR_TEMPLATE_HE: Record<string, string> = {
  wa_opening_new: "שיחה חדשה",
  wa_follow_up: "בהמשך לשיחתנו",
  wa_reminder: "תזכורת ובקשת עדכון",
  wa_general: "כללית",
};

/** The template-only door for NEW conversations (Meta's rule). */
function NewChatDialog({
  members,
  templates,
  presetPhone,
  viewerFirstName,
  onClose,
}: {
  members: WaMemberOption[];
  templates: WaTemplateOption[];
  presetPhone?: string;
  viewerFirstName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const approved = templates.filter((t) => t.status === "APPROVED");
  const [phone, setPhone] = useState(presetPhone ?? "");
  const [memberQuery, setMemberQuery] = useState("");
  const [tplName, setTplName] = useState(approved[0]?.name ?? "");
  const [params, setParams] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tpl = templates.find((t) => t.name === tplName) ?? null;
  const isOurs = !!tpl && tpl.name in OUR_TEMPLATE_HE && tpl.paramCount === 3;

  useEffect(() => {
    // Sender defaults to the logged-in team member's first name (param 2 of
    // our convention) — she overrides freely.
    setParams((p) =>
      Array.from({ length: tpl?.paramCount ?? 0 }, (_, i) =>
        p[i] ?? (isOurs && i === 1 ? viewerFirstName : "")
      )
    );
  }, [tplName, tpl?.paramCount, isOurs, viewerFirstName]);

  const matches = memberQuery.trim()
    ? members.filter((mm) => (mm.name + " " + mm.waId).includes(memberQuery.trim())).slice(0, 6)
    : [];
  const preview = tpl ? tpl.bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] || "____") : "";

  return (
    <div className="fixed inset-0 z-50 bg-ink-1000/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[18px] shadow-xl w-full max-w-lg p-5 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display font-black text-[18px]">שיחה חדשה</h3>
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-ink-400 hover:text-ink-900 font-bold cursor-pointer">✕</button>
        </div>
        <p className="text-[12.5px] text-ink-500 -mt-1.5">
          פתיחת שיחה יזומה נשלחת מתוך תבנית שאושרה במטא — ברגע שהיא עונה, הצ׳אט חופשי.
        </p>

        {approved.length === 0 ? (
          <div className="bg-tint-warm border border-[#F8D98C] rounded-[12px] p-3.5 text-[13px] text-ink-900">
            {templates.length > 0
              ? `${templates.length} תבניות הוגשו וממתינות לאישור מטא (בדרך כלל שעות בודדות) — ברגע שיאושרו, השליחה תיפתח כאן אוטומטית. עד אז אפשר לענות רק לפניות נכנסות.`
              : "אין עדיין תבניות — נוסחי הפתיחה יוגשו למטא ואז יופיעו כאן."}
          </div>
        ) : (
          <>
            <div>
              <label className="text-[12.5px] font-semibold text-ink-700 block mb-1">אל מי?</label>
              <input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="חיפוש חברה לפי שם…"
                className="w-full border border-ink-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-purple"
              />
              {matches.length > 0 && (
                <div className="border border-ink-100 rounded-md mt-1 overflow-hidden">
                  {matches.map((mm) => (
                    <button
                      key={mm.waId}
                      type="button"
                      onClick={() => {
                        setPhone(mm.waId);
                        setMemberQuery(mm.name);
                        // Her first name lands in the name field of our
                        // templates automatically (the owner, 1/9).
                        if (isOurs) {
                          const first = mm.name.split(" ")[0];
                          setParams((p) => p.map((v, j) => (j === 0 && !v ? first : v)));
                        }
                      }}
                      className="w-full text-start px-3 py-1.5 text-[13px] hover:bg-tint-purple/50 cursor-pointer flex justify-between gap-2"
                    >
                      <span>{mm.name}</span>
                      <span className="font-mono text-[11.5px] text-ink-400" dir="ltr">+{mm.waId}</span>
                    </button>
                  ))}
                </div>
              )}
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="או מספר חופשי (לקוחה, מגייסת…): 05X-XXXXXXX"
                dir="ltr"
                className="w-full border border-ink-200 rounded-md px-3 py-2 text-sm mt-2 text-left focus:outline-none focus:border-brand-purple"
              />
            </div>

            <div>
              <label className="text-[12.5px] font-semibold text-ink-700 block mb-1">תבנית פתיחה</label>
              <select
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                className="w-full border border-ink-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-purple"
              >
                {templates.map((t) => (
                  <option key={t.name} value={t.name} disabled={t.status !== "APPROVED"}>
                    {(OUR_TEMPLATE_HE[t.name] ?? t.name) + (t.status !== "APPROVED" ? " (ממתינה לאישור מטא)" : "")}
                  </option>
                ))}
              </select>
            </div>

            {tpl && tpl.paramCount > 0 && (
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: tpl.paramCount }, (_, i) => (
                  <input
                    key={i}
                    value={params[i] ?? ""}
                    onChange={(e) => setParams((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                    placeholder={isOurs ? OUR_PARAM_LABELS[i] : `שדה ${i + 1} בתבנית`}
                    className="w-full border border-ink-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-purple"
                  />
                ))}
              </div>
            )}

            {tpl && (
              <div className="bg-[#E7FCE3] border border-[#B7E3B0] rounded-[12px] p-3 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                {preview}
              </div>
            )}

            {error && <div role="alert" className="text-[12.5px] text-[#A8254B]">{error}</div>}

            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                const fd = new FormData();
                fd.set("phone", phone);
                fd.set("template", tplName);
                params.forEach((p, i) => fd.set(`param${i + 1}`, p));
                startTransition(async () => {
                  const res = await startTemplateConversation(fd);
                  if (!res.ok) setError(res.error ?? "השליחה נכשלה");
                  else {
                    onClose();
                    router.push(`/admin/whatsapp?c=${res.contactId}`);
                  }
                });
              }}
              className="font-display font-semibold text-[14px] py-2.5 rounded-md bg-brand-gradient text-white disabled:opacity-60"
            >
              {pending ? "שולח…" : "שליחת הפתיחה 📤"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function WaInbox({
  contacts,
  activeId,
  messages,
  canSend,
  members,
  templates,
  viewerFirstName,
}: {
  contacts: WaContactRow[];
  activeId: string | null;
  messages: WaMessageRow[];
  canSend: boolean;
  members: WaMemberOption[];
  templates: WaTemplateOption[];
  viewerFirstName: string;
}) {
  const active = contacts.find((c) => c.id === activeId) ?? null;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [newChat, setNewChat] = useState<null | { presetPhone?: string }>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const count = messages.length;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, activeId]);

  const win = active ? windowChip(active.windowLeftMs) : null;
  const shown = useMemo(
    () =>
      search.trim()
        ? contacts.filter((c) => (c.name + " " + c.waId).includes(search.trim()))
        : contacts,
    [contacts, search]
  );

  const insertEmoji = (e: string) => {
    const el = inputRef.current;
    if (!el) return;
    const at = el.selectionStart ?? el.value.length;
    el.value = el.value.slice(0, at) + e + el.value.slice(el.selectionEnd ?? at);
    el.selectionStart = el.selectionEnd = at + e.length;
    el.focus();
  };

  const sendCurrent = () => {
    if (!active || pending) return;
    const text = inputRef.current?.value.trim() ?? "";
    setError(null);
    if (attachment) {
      const fd = new FormData();
      fd.set("file", attachment);
      fd.set("caption", text);
      startTransition(async () => {
        const res = await sendWhatsAppMedia(active.id, fd);
        if (!res.ok) setError(res.error ?? "השליחה נכשלה");
        else {
          setAttachment(null);
          if (inputRef.current) inputRef.current.value = "";
        }
      });
      return;
    }
    if (!text) return;
    const fd = new FormData();
    fd.set("body", text);
    startTransition(async () => {
      const res = await sendWhatsAppReply(active.id, fd);
      if (!res.ok) setError(res.error ?? "השליחה נכשלה");
      else if (inputRef.current) inputRef.current.value = "";
    });
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // WhatsApp accepts ogg/opus, mp4/aac, mpeg — try in that order; a
      // browser that only does webm gets an honest error from Meta.
      const mime = ["audio/ogg;codecs=opus", "audio/mp4", "audio/webm;codecs=opus"].find((m) =>
        MediaRecorder.isTypeSupported(m)
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const type = rec.mimeType.split(";")[0] || "audio/webm";
        const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const raw = new File([new Blob(chunks, { type })], `voice-note.${ext}`, { type });
        // webm → mp3 happens here, before it ever reaches Meta.
        toWhatsAppAudio(raw)
          .then(setAttachment)
          .catch(() => setError("עיבוד ההקלטה נכשל — נסי שוב"));
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("אין גישה למיקרופון — בדקי את הרשאות הדפדפן");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 min-h-[480px]">
      {newChat && (
        <NewChatDialog
          members={members}
          templates={templates}
          presetPhone={newChat.presetPhone}
          viewerFirstName={viewerFirstName}
          onClose={() => setNewChat(null)}
        />
      )}

      {/* conversation list */}
      <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm overflow-hidden flex flex-col">
        <div className="p-2.5 border-b border-ink-100 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setNewChat({})}
            className="font-display font-semibold text-[13px] py-2 rounded-md bg-brand-gradient text-white"
          >
            ＋ שיחה חדשה
          </button>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש איש קשר…"
            aria-label="חיפוש איש קשר"
            className="w-full border border-ink-200 rounded-md px-3 py-1.5 text-[13px] focus:outline-none focus:border-brand-purple"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {shown.length === 0 && (
            <p className="text-[13px] text-ink-500 p-4 text-center">
              {contacts.length === 0 ? "אין עדיין שיחות — ברגע שמישהי תכתוב למספר, היא תופיע כאן 💜" : "אין תוצאה לחיפוש"}
            </p>
          )}
          {shown.map((c) => (
            <Link
              key={c.id}
              href={`/admin/whatsapp?c=${c.id}`}
              className={cn(
                "block px-3.5 py-2.5 border-b border-ink-50 hover:bg-ink-50 transition-colors",
                c.id === activeId && "bg-tint-purple/40"
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-[13.5px] text-ink-900 truncate flex-1">{c.name}</span>
                {c.isMember && (
                  <span className="text-[10px] font-bold bg-tint-purple text-brand-purple px-1.5 py-0.5 rounded-full shrink-0">
                    חברת קהילה
                  </span>
                )}
              </span>
              <span className="flex items-center justify-between mt-0.5">
                <span className="font-mono text-[11px] text-ink-400" dir="ltr">
                  +{c.waId}
                </span>
                {c.lastMessageAt && (
                  <span className="text-[11px] text-ink-400">{TIME_IL.format(new Date(c.lastMessageAt))}</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* thread */}
      <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm flex flex-col overflow-hidden">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-ink-500 text-sm p-6 text-center">
            בחרי שיחה מהרשימה, או פתחי חדשה עם ＋ 💜
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-ink-100 flex items-center gap-2 flex-wrap">
              <span className="font-display font-bold text-ink-1000">{active.name}</span>
              <span className="font-mono text-[11.5px] text-ink-400" dir="ltr">
                +{active.waId}
              </span>
              {win && (
                <span
                  className={cn(
                    "ms-auto text-[11px] font-bold px-2 py-0.5 rounded-full",
                    win.open ? "bg-tint-mint text-[#0E6B4A]" : "bg-ink-100 text-ink-500"
                  )}
                >
                  {win.label}
                </span>
              )}
            </div>

            <div ref={listRef} className="flex-1 min-h-0 max-h-[440px] overflow-y-auto p-4 flex flex-col gap-1.5 bg-ink-50/40">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex flex-col max-w-[75%]", m.direction === "out" ? "self-end items-end" : "self-start items-start")}
                >
                  <div
                    className={cn(
                      "px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap rounded-2xl flex flex-col gap-1.5",
                      m.direction === "out"
                        ? "bg-[#DCF8C6] text-ink-900 rounded-br-md"
                        : "bg-white border border-ink-200 text-ink-900 rounded-bl-md",
                      m.kind === "template" && "border-s-2 border-brand-purple"
                    )}
                  >
                    <MediaBubble m={m} />
                    {(m.kind === "text" || m.kind === "template" || (m.body && !m.body.startsWith("["))) && (
                      <span><Linkify text={m.body} /></span>
                    )}
                  </div>
                  <span className="text-[10.5px] text-ink-400 mt-0.5 px-1">
                    {m.kind === "template" && "תבנית · "}
                    {TIME_IL.format(new Date(m.created_at))}
                    {m.direction === "out" && ` · ${STATUS_HE[m.status] ?? m.status}`}
                    {m.status === "failed" && m.error && ` — ${m.error}`}
                  </span>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-sm text-ink-500 text-center my-auto">אין הודעות בשיחה הזו</p>
              )}
            </div>

            {error && (
              <div role="alert" className="px-4 py-2 border-t border-ink-100 text-[12.5px] text-[#A8254B] bg-danger-bg">
                {error}
              </div>
            )}

            {attachment && (
              <div className="px-4 py-2 border-t border-ink-100 bg-tint-purple/30 flex items-center gap-2 text-[13px]">
                <span className="flex-1 truncate">
                  {attachment.type.startsWith("audio/") ? "🎤 הקלטה קולית מוכנה" : `📎 ${attachment.name}`}
                  <span className="text-ink-400"> · {(attachment.size / 1024).toFixed(0)}KB</span>
                </span>
                <button type="button" onClick={() => setAttachment(null)} aria-label="ביטול הקובץ" className="text-ink-400 hover:text-ink-900 font-bold cursor-pointer">✕</button>
              </div>
            )}

            {canSend && win?.open ? (
              <div className="border-t border-ink-100 p-3 flex flex-col gap-2">
                {emojiOpen && (
                  <div className="flex flex-wrap gap-1 bg-ink-50 rounded-md p-2">
                    {EMOJIS.map((e) => (
                      <button key={e} type="button" onClick={() => insertEmoji(e)} className="text-[20px] p-1 rounded hover:bg-white cursor-pointer">
                        {e}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-1.5">
                  <button type="button" onClick={() => setEmojiOpen((v) => !v)} aria-label="אימוג'ים" title="אימוג'ים" className="w-9 h-9 rounded-full text-[18px] hover:bg-ink-100 cursor-pointer shrink-0">😊</button>
                  <button type="button" onClick={() => fileRef.current?.click()} aria-label="צירוף קובץ" title="תמונה / סרטון / קובץ (עד 4MB)" className="w-9 h-9 rounded-full text-[17px] hover:bg-ink-100 cursor-pointer shrink-0">📎</button>
                  <button
                    type="button"
                    onClick={toggleRecording}
                    aria-label={recording ? "סיום הקלטה" : "הקלטה קולית"}
                    title={recording ? "סיום הקלטה" : "הקלטה קולית"}
                    className={cn("w-9 h-9 rounded-full text-[17px] cursor-pointer shrink-0", recording ? "bg-danger-bg animate-pulse" : "hover:bg-ink-100")}
                  >
                    {recording ? "⏹" : "🎤"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/mp4,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setAttachment(f);
                      e.target.value = "";
                    }}
                  />
                  <textarea
                    ref={inputRef}
                    rows={2}
                    placeholder={attachment ? "כיתוב לקובץ (לא חובה)…" : "כתבי הודעה…"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendCurrent();
                      }
                    }}
                    className="flex-1 resize-none border border-ink-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-purple"
                  />
                  <button
                    type="button"
                    onClick={sendCurrent}
                    disabled={pending}
                    className="font-display font-semibold text-[13.5px] px-5 py-2.5 rounded-md bg-brand-gradient text-white disabled:opacity-60 shrink-0"
                  >
                    {pending ? "שולח…" : "שליחה"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-ink-100 p-3.5 text-[13px] text-ink-500 text-center bg-ink-50 flex flex-col items-center gap-2">
                {!canSend
                  ? "שליחה תיפתח כשהחיבור למטא יושלם — ההודעות הנכנסות כבר נשמרות."
                  : "חלון ה-24 שעות של מטא נסגר — מענה חופשי אפשרי רק תוך יממה מההודעה האחרונה שלה."}
                {canSend && (
                  <button
                    type="button"
                    onClick={() => setNewChat({ presetPhone: active.waId })}
                    className="font-display font-semibold text-[13px] px-4 py-2 rounded-md border-[1.5px] border-brand-purple text-brand-purple hover:bg-tint-purple transition-colors cursor-pointer"
                  >
                    פתיחה מחדש עם תבנית 📨
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
