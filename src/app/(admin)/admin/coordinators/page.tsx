import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadCoordinatorMessages,
  loadCoordinatorThreads,
  markCoordinatorMessagesRead,
} from "@/lib/coordinator-data";
import { cn } from "@/lib/utils";
import { JobTabs } from "../jobs/[id]/job-tabs";
import { ContactsManager, type AdminContact } from "./contacts-manager";
import { CoordinatorReplyForm } from "./reply-form";

export const metadata: Metadata = { title: "רכזות מוסדות" };
export const dynamic = "force-dynamic";

const CHAT_TIME_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/**
 * רכזות מוסדות (the owner, 14/9): the contact people of every study
 * institution — reachable by email from here — and the keys to their private
 * portal (/coordinator, OTP login). A contact may serve several institutions.
 * Since 16/9 also the team's chat desk with the coordinators.
 */
export default async function AdminCoordinatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; chat?: string }>;
}) {
  const me = await requireRole("admin");
  const { tab, chat } = await searchParams;
  const admin = createAdminClient();

  const [{ data: contacts }, { data: links }, { data: reviews }, { data: emails }, { data: placeQ }] =
    await Promise.all([
      admin
        .from("institution_contacts")
        .select("id, full_name, email, phone, created_at")
        .order("full_name"),
      admin.from("institution_contact_links").select("contact_id, institution"),
      admin.from("coordinator_reviews").select("contact_id"),
      admin
        .from("contact_emails")
        .select("id, contact_id, subject, body, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      admin.from("config_questions").select("options").eq("key", "study_place").maybeSingle(),
    ]);

  const reviewCount = new Map<string, number>();
  for (const r of reviews ?? []) reviewCount.set(r.contact_id, (reviewCount.get(r.contact_id) ?? 0) + 1);

  const rows: AdminContact[] = (contacts ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    email: c.email,
    phone: c.phone,
    institutions: (links ?? []).filter((l) => l.contact_id === c.id).map((l) => l.institution),
    reviewCount: reviewCount.get(c.id) ?? 0,
    emails: (emails ?? [])
      .filter((e) => e.contact_id === c.id)
      .map((e) => ({ id: e.id, subject: e.subject, body: e.body, created_at: e.created_at })),
  }));

  const institutionOptions = ((placeQ?.options as { value: string; label: string }[] | null) ?? []).filter(
    (o) => o.value !== "other"
  );

  // ─────────────────────────────────────── chats (the owner, 16/9)
  const threads = await loadCoordinatorThreads();
  const totalUnread = threads.reduce((n, t) => n + t.unread, 0);
  const openChat = chat && (contacts ?? []).some((c) => c.id === chat) ? chat : null;
  const chatMessages = openChat ? await loadCoordinatorMessages(openChat) : [];
  if (openChat) await markCoordinatorMessagesRead(openChat, "team");
  const openChatName = openChat
    ? ((contacts ?? []).find((c) => c.id === openChat)?.full_name ?? "רכזת")
    : null;

  const chatsPanel = (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 items-start">
      <div className="bg-white border border-ink-200 rounded-[16px] p-3 shadow-sm flex flex-col">
        <h3 className="font-display font-bold text-[14px] text-ink-1000 px-1 mb-1">שיחות</h3>
        {threads.map((t) => (
          <Link
            key={t.contact_id}
            href={`/admin/coordinators?tab=chats&chat=${t.contact_id}`}
            className={cn(
              "rounded-[10px] px-2.5 py-2 hover:bg-tint-purple/40 transition-colors",
              openChat === t.contact_id && "bg-tint-purple/60"
            )}
          >
            <span className="flex items-center gap-2">
              <span className="font-semibold text-[13px] text-ink-900 truncate flex-1">
                {t.contact_name}
              </span>
              {t.unread > 0 && (
                <span className="bg-brand-pink-deep text-white text-[10.5px] font-bold rounded-full px-1.5 py-0.5">
                  {t.unread}
                </span>
              )}
            </span>
            <span className="block text-[11.5px] text-ink-500 truncate">
              {t.lastSender === "team" ? "אנחנו: " : ""}
              {t.lastBody}
            </span>
          </Link>
        ))}
        {threads.length === 0 && (
          <p className="text-ink-500 text-[12.5px] px-1 py-3">
            עוד אין שיחות — הרכזות יכולות לכתוב לנו מהאזור האישי שלהן.
          </p>
        )}
      </div>

      <div className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm flex flex-col gap-2.5">
        {openChat ? (
          <>
            <h3 className="font-display font-bold text-[15px] text-ink-1000">{openChatName}</h3>
            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pe-1">
              {chatMessages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-[14px] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap",
                    m.sender === "team"
                      ? "self-end bg-tint-purple text-ink-900 rounded-ee-[4px]"
                      : "self-start bg-ink-50 border border-ink-100 text-ink-900 rounded-es-[4px]"
                  )}
                >
                  {m.sender === "team" && m.team_author_name && (
                    <div className="text-[11px] font-bold text-brand-purple mb-0.5">{m.team_author_name}</div>
                  )}
                  {m.body}
                  <div className="text-[10.5px] text-ink-400 mt-1 text-start" dir="ltr">
                    {CHAT_TIME_HE.format(new Date(m.created_at))}
                  </div>
                </div>
              ))}
              {chatMessages.length === 0 && (
                <p className="text-ink-500 text-sm py-3">עוד אין הודעות בשיחה הזו.</p>
              )}
            </div>
            <CoordinatorReplyForm contactId={openChat} signature={me.full_name} />
          </>
        ) : (
          <p className="text-ink-500 text-sm py-6 text-center">בחרי שיחה מהרשימה 💜</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;רכזות/&gt;</span>
        <h1 className="font-display text-[26px] font-black text-ink-1000 mt-1">רכזות מוסדות 🎓</h1>
        <p className="t-body-sm text-ink-700">
          אנשי הקשר של מוסדות הלימוד. לכל רכזת אזור אישי ב-
          <span dir="ltr" className="font-mono text-[13px]">/coordinator</span> — כניסה עם קוד חד-פעמי
          למייל. רכזת יכולה להיות מקושרת לכמה מוסדות, ומה שהיא כותבת שם גלוי רק לה ולנו.
        </p>
      </div>

      <JobTabs
        tabs={[
          { key: "contacts", label: "רכזות", count: rows.length },
          { key: "chats", label: totalUnread > 0 ? `צ'אטים · ${totalUnread} חדשות` : "צ'אטים" },
        ]}
        initialTab={tab === "chats" ? "chats" : "contacts"}
        panels={{
          contacts: <ContactsManager contacts={rows} institutionOptions={institutionOptions} />,
          chats: chatsPanel,
        }}
      />
    </div>
  );
}
