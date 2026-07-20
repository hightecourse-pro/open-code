"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Building2, Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Field, Input } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import {
  createPortalClient,
  deletePortalClient,
  regeneratePortalPassword,
  setPortalClientActive,
  type ClientFormState,
} from "./actions";

export interface PortalClientRow {
  id: string;
  company_name: string;
  username: string;
  contact_name: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  job_count: number;
}

/** Copies text and flips to a confirmation for a moment. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard can be blocked (insecure origin / permissions); the value
          // is on screen and selectable, so failing quietly is fine.
        }
      }}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-purple hover:text-brand-pink-deep transition-colors"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "הועתק" : label}
    </button>
  );
}

/**
 * The one and only sighting of a generated password — the DB stores a scrypt
 * hash, so this panel is genuinely the last chance to write it down.
 */
function CredentialsPanel({
  company,
  username,
  password,
}: {
  company?: string;
  username: string;
  password: string;
}) {
  return (
    <div className="border border-crown-gold-soft bg-tint-warm rounded-[18px] p-4 flex flex-col gap-3">
      <div>
        <b className="font-display font-bold text-ink-1000 block">
          {company ? `פרטי ההתחברות של ${company}` : "פרטי ההתחברות"}
        </b>
        <span className="text-[12.5px] text-[#8C5E0E]">
          העתיקו ושמרו — הסיסמה לא תוצג שוב
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="bg-white/70 border border-crown-gold-soft rounded-sm px-3 py-2">
          <div className="text-[11px] font-semibold text-ink-500 mb-0.5">שם משתמש</div>
          <div className="flex items-center justify-between gap-2">
            <code dir="ltr" className="font-mono text-sm text-ink-1000 select-all">
              {username}
            </code>
            <CopyButton value={username} label="העתקה" />
          </div>
        </div>

        <div className="bg-white/70 border border-crown-gold-soft rounded-sm px-3 py-2">
          <div className="text-[11px] font-semibold text-ink-500 mb-0.5">סיסמה</div>
          <div className="flex items-center justify-between gap-2">
            <code dir="ltr" className="font-mono text-sm font-bold text-ink-1000 select-all tracking-wide">
              {password}
            </code>
            <CopyButton value={password} label="העתקה" />
          </div>
        </div>
      </div>

      <p className="text-[12px] text-[#8C5E0E]">
        הכניסה לפורטל היא בכתובת{" "}
        <span className="font-mono" dir="ltr">
          /portal/login
        </span>
        .
      </p>
    </div>
  );
}

function ClientRow({ client }: { client: PortalClientRow }) {
  const [pending, start] = useTransition();
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="py-3.5 border-b border-ink-100 last:border-b-0 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-ink-900">{client.company_name}</span>
            <Badge variant={client.is_active ? "mint" : "tech"} dot>
              {client.is_active ? "פעיל" : "מושבת"}
            </Badge>
          </div>
          <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <code dir="ltr" className="font-mono text-ink-700">
              {client.username}
            </code>
            {client.contact_name && <span>· {client.contact_name}</span>}
            {client.contact_email && (
              <span dir="ltr" className="font-mono">
                · {client.contact_email}
              </span>
            )}
          </div>
        </div>

        <div className="text-xs text-ink-500 min-w-[110px]">
          <div>{client.job_count} משרות מקושרות</div>
          <div>
            {client.last_login_at ? `כניסה ${timeAgo(client.last_login_at)}` : "טרם התחברה"}
          </div>
        </div>

        <div className="flex gap-1.5 items-center">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setError(null);
              start(async () => {
                const res = await regeneratePortalPassword(client.id);
                if (res.error) setError(res.error);
                else if (res.password) setIssued(res.password);
              });
            }}
          >
            <KeyRound size={14} />
            סיסמה חדשה
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              start(() => void setPortalClientActive(client.id, !client.is_active));
            }}
          >
            {client.is_active ? "השבתה" : "הפעלה"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            className="text-danger hover:bg-danger-bg"
            onClick={() => {
              if (
                window.confirm(
                  `למחוק את "${client.company_name}"? הגישה שלה לפורטל תיחסם מיד. משרות מקושרות יישארו במערכת ללא לקוח.`
                )
              ) {
                start(() => void deletePortalClient(client.id));
              }
            }}
          >
            <Trash2 size={14} />
            מחיקה
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {issued && (
        <CredentialsPanel
          company={client.company_name}
          username={client.username}
          password={issued}
        />
      )}
    </div>
  );
}

export function ClientsManager({ clients }: { clients: PortalClientRow[] }) {
  const [state, action, pending] = useActionState<ClientFormState, FormData>(
    createPortalClient,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.created) formRef.current?.reset();
  }, [state.created]);

  return (
    <>
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">הוספת לקוח</h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          הסיסמה נוצרת אוטומטית ומוצגת פעם אחת בלבד לאחר השמירה.
        </p>

        <form ref={formRef} action={action} className="flex flex-col gap-3">
          {state.error && <Alert variant="danger">{state.error}</Alert>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="שם החברה" htmlFor="company_name">
              <Input id="company_name" name="company_name" required placeholder="לדוגמה: אלטא סייבר" />
            </Field>
            <Field label="שם משתמש (אנגלית, ללא רווחים)" htmlFor="username">
              <Input
                id="username"
                name="username"
                dir="ltr"
                required
                autoComplete="off"
                placeholder="alta-cyber"
              />
            </Field>
            <Field label="איש/אשת קשר (אופציונלי)" htmlFor="contact_name">
              <Input id="contact_name" name="contact_name" placeholder="לדוגמה: נועה לוי" />
            </Field>
            <Field label="אימייל ליצירת קשר (אופציונלי)" htmlFor="contact_email">
              <Input id="contact_email" name="contact_email" type="email" dir="ltr" autoComplete="off" />
            </Field>
          </div>

          <Button type="submit" disabled={pending} className="w-fit" bracketed>
            {pending ? "יוצרת לקוח…" : "יצירת לקוח"}
          </Button>
        </form>

        {state.created && (
          <div className="mt-4">
            <CredentialsPanel
              company={state.created.company}
              username={state.created.username}
              password={state.created.password}
            />
          </div>
        )}
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">
          כל הלקוחות ({clients.length})
        </h3>

        {clients.length > 0 ? (
          <div className="flex flex-col">
            {clients.map((c) => (
              <ClientRow key={c.id} client={c} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Building2 size={28} className="text-ink-300" />
            <p className="text-ink-500 text-sm">אין עדיין לקוחות פורטל.</p>
          </div>
        )}
      </div>
    </>
  );
}
