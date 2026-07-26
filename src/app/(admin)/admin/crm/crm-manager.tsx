"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Briefcase, Building2, ChevronDown, KeyRound, Search, X } from "lucide-react";
import { Alert, Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";
import { createCrmLead, updateCrmClient, type FormState } from "../actions";
import type { BadgeProps } from "@/components/ui";
import type { ClientCrmStatus, JobPipelineStatus } from "@/types/database";

export interface CrmJobRow {
  id: string;
  title: string;
  pipeline_status: JobPipelineStatus;
}

export interface CrmClientRow {
  id: string;
  company_name: string;
  /** Null until portal credentials are assigned on the clients screen. */
  username: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  crm_status: ClientCrmStatus;
  crm_notes: string | null;
  created_at: string;
  jobs: CrmJobRow[];
}

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const CRM_STATUS: Record<ClientCrmStatus, { label: string; variant: BadgeVariant }> = {
  initial_call: { label: "שיחה ראשונית", variant: "tech" },
  materials_sent: { label: "נשלחו חומרים", variant: "indigo" },
  job_active: { label: "משרה בטיפול", variant: "mint" },
  hired: { label: "גייסה", variant: "warm" },
};

const CRM_STATUS_ORDER: ClientCrmStatus[] = [
  "initial_call",
  "materials_sent",
  "job_active",
  "hired",
];

const PIPELINE: Record<JobPipelineStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "לא פורסם", variant: "tech" },
  published: { label: "פורסם", variant: "indigo" },
  candidates_sent: { label: "נשלחו מועמדות", variant: "purple" },
  interviews: { label: "ראיונות", variant: "warm" },
  hired: { label: "גויס", variant: "mint" },
  closed_no_hire: { label: "נסגר ללא גיוס", variant: "pink" },
};

/** Inline edit of contact details + status + internal notes for one client. */
function ClientEditForm({ client }: { client: CrmClientRow }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    (prev, formData) => updateCrmClient(client.id, prev, formData),
    {}
  );

  return (
    <form action={action} className="flex flex-col gap-2.5">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">נשמר ✓</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="איש/אשת קשר" htmlFor={`crm-name-${client.id}`}>
          <Input
            id={`crm-name-${client.id}`}
            name="contact_name"
            defaultValue={client.contact_name ?? ""}
            placeholder="לדוגמה: נועה לוי"
          />
        </Field>
        <Field label="טלפון" htmlFor={`crm-phone-${client.id}`}>
          <Input
            id={`crm-phone-${client.id}`}
            name="contact_phone"
            type="tel"
            dir="ltr"
            defaultValue={client.contact_phone ?? ""}
            placeholder="050-0000000"
          />
        </Field>
        <Field label="אימייל" htmlFor={`crm-email-${client.id}`}>
          <Input
            id={`crm-email-${client.id}`}
            name="contact_email"
            type="email"
            dir="ltr"
            defaultValue={client.contact_email ?? ""}
          />
        </Field>
        <Field label="סטטוס" htmlFor={`crm-status-${client.id}`}>
          <Select
            id={`crm-status-${client.id}`}
            name="crm_status"
            defaultValue={client.crm_status}
          >
            {CRM_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {CRM_STATUS[s].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="הערות פנימיות (רק לך)" htmlFor={`crm-notes-${client.id}`}>
        <Textarea
          id={`crm-notes-${client.id}`}
          name="crm_notes"
          defaultValue={client.crm_notes ?? ""}
          placeholder="סיכום שיחה, דרישות, המשך טיפול…"
        />
      </Field>

      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        {pending ? "שומרת…" : "שמירה"}
      </Button>
    </form>
  );
}

/** One client — collapsed summary row that expands to edit + jobs. */
function ClientRow({ client }: { client: CrmClientRow }) {
  const [open, setOpen] = useState(false);
  const st = CRM_STATUS[client.crm_status] ?? CRM_STATUS.initial_call;
  const needsCredentials = client.crm_status === "job_active" && !client.username;

  return (
    <div className="border-b border-ink-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-start flex items-center gap-3 py-3 flex-wrap hover:bg-ink-50/60 transition-colors rounded-sm px-1 -mx-1"
      >
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-ink-900">{client.company_name}</span>
            <Badge variant={st.variant} dot>
              {st.label}
            </Badge>
            {needsCredentials && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8C5E0E] bg-tint-warm border border-crown-gold-soft px-1.5 py-0.5 rounded-full">
                <KeyRound size={11} /> ללא פרטי גישה
              </span>
            )}
          </div>
          <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            {client.contact_name && <span>{client.contact_name}</span>}
            {client.contact_phone && (
              <span dir="ltr" className="font-mono">
                · {client.contact_phone}
              </span>
            )}
            {client.contact_email && (
              <span dir="ltr" className="font-mono">
                · {client.contact_email}
              </span>
            )}
            {!client.contact_name && !client.contact_phone && !client.contact_email && (
              <span className="text-ink-400">אין פרטי קשר עדיין</span>
            )}
          </div>
        </div>

        <div className="text-xs text-ink-500 text-start min-w-[100px]">
          <div className="inline-flex items-center gap-1">
            <Briefcase size={12} className="shrink-0" />
            {client.jobs.length} משרות
          </div>
          <div>{timeAgo(client.created_at)}</div>
        </div>

        <ChevronDown
          size={16}
          className={cn("text-ink-400 shrink-0 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="pb-4 pt-1 px-1 flex flex-col gap-4">
          {needsCredentials && (
            <Alert variant="warn">
              טרם הוקצו פרטי גישה —{" "}
              <Link href="/admin/clients" className="font-semibold underline hover:text-brand-pink-deep">
                הקצי במסך לקוחות פורטל
              </Link>
            </Alert>
          )}

          <ClientEditForm client={client} />

          <div>
            <div className="text-xs font-semibold text-ink-700 mb-1.5">
              המשרות של {client.company_name} ({client.jobs.length})
            </div>
            {client.jobs.length > 0 ? (
              <div className="flex flex-col">
                {client.jobs.map((j) => {
                  const p = PIPELINE[j.pipeline_status] ?? PIPELINE.draft;
                  return (
                    <Link
                      key={j.id}
                      href={`/admin/jobs/${j.id}`}
                      className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-b-0 group"
                    >
                      <span className="flex-1 min-w-0 truncate text-sm text-ink-900 group-hover:text-brand-purple transition-colors">
                        {j.title}
                      </span>
                      <Badge variant={p.variant}>{p.label}</Badge>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-ink-500 text-sm py-1">אין משרות ללקוחה הזו עדיין.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CrmManager({ clients }: { clients: CrmClientRow[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createCrmLead, {});
  const formRef = useRef<HTMLFormElement>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ClientCrmStatus | "all">("all");
  const [sort, setSort] = useState<"newest" | "name">("newest");

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const countOf = useMemo(() => {
    const m = new Map<ClientCrmStatus, number>();
    for (const c of clients) m.set(c.crm_status, (m.get(c.crm_status) ?? 0) + 1);
    return m;
  }, [clients]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clients
      .filter((c) => {
        if (status !== "all" && c.crm_status !== status) return false;
        if (!needle) return true;
        return [c.company_name, c.contact_name, c.contact_email, c.contact_phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle));
      })
      .sort((a, b) =>
        sort === "name"
          ? a.company_name.localeCompare(b.company_name, "he")
          : +new Date(b.created_at) - +new Date(a.created_at)
      );
  }, [clients, q, status, sort]);

  return (
    <>
      {/* add lead */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">הוספת ליד</h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          כל שיחה ראשונית עם חברה נכנסת לכאן. פרטי גישה לפורטל מקצים רק כשמגיעים
          ל&quot;משרה בטיפול&quot;.
        </p>

        <form ref={formRef} action={action} className="flex flex-col gap-3">
          {state.error && <Alert variant="danger">{state.error}</Alert>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="שם החברה" htmlFor="crm-new-company">
              <Input id="crm-new-company" name="company_name" required placeholder="לדוגמה: אלטא סייבר" />
            </Field>
            <Field label="איש/אשת קשר (אופציונלי)" htmlFor="crm-new-contact">
              <Input id="crm-new-contact" name="contact_name" placeholder="לדוגמה: נועה לוי" />
            </Field>
            <Field label="טלפון (אופציונלי)" htmlFor="crm-new-phone">
              <Input id="crm-new-phone" name="contact_phone" type="tel" dir="ltr" placeholder="050-0000000" />
            </Field>
            <Field label="אימייל (אופציונלי)" htmlFor="crm-new-email">
              <Input id="crm-new-email" name="contact_email" type="email" dir="ltr" autoComplete="off" />
            </Field>
          </div>

          <Button type="submit" disabled={pending} className="w-fit" bracketed>
            {pending ? "מוסיפה…" : "הוספת ליד"}
          </Button>
        </form>
      </div>

      {/* search / filter / sort */}
      <div className="bg-white border border-ink-200 rounded-md p-3 flex flex-wrap gap-2 items-center shadow-sm">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי חברה / איש קשר…"
            className="w-full ps-9 pe-8 py-2 rounded-md border border-ink-300 text-sm outline-none focus:border-brand-purple"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="ניקוי חיפוש"
              className="absolute top-1/2 -translate-y-1/2 end-2 text-ink-400 hover:text-ink-700"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", ...CRM_STATUS_ORDER] as const).map((s) => {
            const on = status === s;
            const label = s === "all" ? `הכל (${clients.length})` : `${CRM_STATUS[s].label} (${countOf.get(s) ?? 0})`;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "text-[12px] font-semibold px-2.5 py-1 rounded-full border transition-colors",
                  on
                    ? "bg-brand-gradient text-white border-transparent"
                    : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "newest" | "name")}
          aria-label="מיון"
          className="px-3 py-2 rounded-md border border-ink-300 text-sm"
        >
          <option value="newest">חדשות קודם</option>
          <option value="name">לפי שם החברה</option>
        </select>
      </div>

      {/* pipeline list */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">
          כל הלקוחות ({rows.length})
        </h3>

        {rows.length > 0 ? (
          <div className="flex flex-col">
            {rows.map((c) => (
              <ClientRow key={c.id} client={c} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Building2 size={28} className="text-ink-300" />
            <p className="text-ink-500 text-sm">
              {clients.length === 0 ? "אין עדיין לקוחות. הוסיפי את הליד הראשון למעלה." : "אין תוצאות לסינון הזה."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
