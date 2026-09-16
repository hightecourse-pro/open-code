"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Eye, Mail, Pencil, Phone, Plus, Send, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { ConfirmActionButton } from "@/components/patterns/confirm-action-button";
import { cn } from "@/lib/utils";
import {
  deleteContact,
  saveContact,
  sendContactEmail,
  setContactPortalEnabled,
  viewAsCoordinator,
  type ContactEmailState,
  type ContactFormState,
} from "./actions";

export interface AdminContact {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  portal_enabled: boolean;
  /** institution value → does she manage its reviews. */
  institutions: { value: string; manages: boolean }[];
  reviewCount: number;
  emails: { id: string; subject: string | null; body: string; created_at: string }[];
}

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

function ContactForm({
  contact,
  institutionOptions,
  onDone,
}: {
  contact: AdminContact | null;
  institutionOptions: { value: string; label: string }[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ContactFormState, FormData>(saveContact, {});
  // Controlled institution set so each checked one can show its own
  // "מנהלת חוות דעת" sub-toggle (the owner, 16/9).
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((contact?.institutions ?? []).map((i) => i.value))
  );
  const [manages, setManages] = useState<Set<string>>(
    () => new Set((contact?.institutions ?? []).filter((i) => i.manages).map((i) => i.value))
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3 bg-tint-purple/40 border border-[#DDC9EC] rounded-[14px] p-4">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="שם מלא" htmlFor="ct-name">
          <Input id="ct-name" name="full_name" required defaultValue={contact?.full_name ?? ""} />
        </Field>
        <Field label="מייל (איתו היא נכנסת — אפשר להשלים אחר כך)" htmlFor="ct-email">
          <Input id="ct-email" name="email" type="email" dir="ltr" defaultValue={contact?.email ?? ""} />
        </Field>
        <Field label="טלפון" htmlFor="ct-phone">
          <Input id="ct-phone" name="phone" dir="ltr" defaultValue={contact?.phone ?? ""} />
        </Field>
      </div>
      <Field label="הערות (פנימי)" htmlFor="ct-notes">
        <Textarea id="ct-notes" name="notes" rows={2} maxLength={2000} defaultValue={contact?.notes ?? ""} />
      </Field>
      <div>
        <div className="t-label text-ink-700 mb-1.5">
          המוסדות שלה — ולצד כל מוסד: האם היא מנהלת את חוות הדעת שלו
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {institutionOptions.map((o) => {
            const on = selected.has(o.value);
            return (
              <div key={o.value} className="flex items-center gap-2 flex-wrap">
                <Checkbox
                  name="institutions"
                  value={o.value}
                  checked={on}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(o.value);
                      else next.delete(o.value);
                      return next;
                    });
                    if (e.target.checked)
                      setManages((prev) => new Set(prev).add(o.value));
                  }}
                  label={o.label}
                />
                {on && (
                  <label className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#8C5E0E] bg-tint-warm rounded-full px-2 py-0.5 cursor-pointer">
                    <input
                      type="checkbox"
                      name="manages"
                      value={o.value}
                      checked={manages.has(o.value)}
                      onChange={(e) =>
                        setManages((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(o.value);
                          else next.delete(o.value);
                          return next;
                        })
                      }
                      className="accent-[#8C5E0E]"
                    />
                    מנהלת חוות דעת
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "שומרת…" : contact ? "עדכון הרכזת" : "הוספת הרכזת"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

function ComposeForm({ contact, onClose }: { contact: AdminContact; onClose: () => void }) {
  const [state, action, pending] = useActionState<ContactEmailState, FormData>(sendContactEmail, {});

  return (
    <form action={action} className="flex flex-col gap-2.5 bg-ink-50 border border-ink-200 rounded-[12px] p-3.5 mt-2">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">המייל נשלח ל-{contact.email} ✓</Alert>}
      <input type="hidden" name="contact_id" value={contact.id} />
      <Field label="נושא" htmlFor={`sub-${contact.id}`}>
        <Input id={`sub-${contact.id}`} name="subject" placeholder="הודעה מצוות קוד פתוח 💜" maxLength={200} />
      </Field>
      <Field label="תוכן ההודעה" htmlFor={`body-${contact.id}`}>
        <Textarea id={`body-${contact.id}`} name="body" rows={5} required maxLength={8000} />
      </Field>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          <Send size={14} /> {pending ? "שולחת…" : "שליחת המייל"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          סגירה
        </Button>
      </div>
    </form>
  );
}

export function ContactsManager({
  contacts,
  institutionOptions,
}: {
  contacts: AdminContact[];
  institutionOptions: { value: string; label: string }[];
}) {
  const [editing, setEditing] = useState<string | null>(null); // contact id | "new"
  const [composing, setComposing] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const labelOf = new Map(institutionOptions.map((o) => [o.value, o.label]));

  return (
    <div className="flex flex-col gap-4">
      {editing === "new" ? (
        <ContactForm contact={null} institutionOptions={institutionOptions} onDone={() => setEditing(null)} />
      ) : (
        <div>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus size={15} /> הוספת רכזת
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {contacts.map((c) => (
          <div key={c.id} className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm">
            {editing === c.id ? (
              <ContactForm contact={c} institutionOptions={institutionOptions} onDone={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-display font-bold text-[16px] text-ink-1000 flex items-center gap-2">
                      {c.full_name}
                      {!c.portal_enabled && <Badge variant="gray">כניסה כבויה</Badge>}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-[12.5px] text-ink-600 mt-0.5">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} dir="ltr" className="inline-flex items-center gap-1 hover:text-brand-purple">
                          <Mail size={13} /> {c.email}
                        </a>
                      ) : (
                        <span className="text-[#8C5E0E] font-semibold">בלי מייל — לא יכולה להיכנס עדיין</span>
                      )}
                      {c.phone && (
                        <span dir="ltr" className="inline-flex items-center gap-1">
                          <Phone size={13} /> {c.phone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {c.institutions.map((i) => (
                        <Badge key={i.value} variant="purple">
                          {labelOf.get(i.value) ?? i.value}
                          {i.manages && <span title="מנהלת את חוות הדעת"> ⭐</span>}
                        </Badge>
                      ))}
                      {c.institutions.length === 0 && <Badge variant="gray">לא מקושרת למוסד</Badge>}
                      {c.reviewCount > 0 && <Badge variant="mint">📝 {c.reviewCount} חוות דעת</Badge>}
                    </div>
                    {c.notes && (
                      <p className="text-[11.5px] text-ink-500 mt-1 whitespace-pre-wrap">{c.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <ConfirmActionButton
                      action={() => setContactPortalEnabled(c.id, !c.portal_enabled)}
                      message={
                        c.portal_enabled
                          ? `לכבות ל${c.full_name} את הכניסה לפורטל? היא לא תוכל להיכנס עד שתדליקי שוב.`
                          : `להדליק ל${c.full_name} את הכניסה לפורטל?`
                      }
                      title="כניסה לפורטל"
                      className={cn(
                        "text-[12px] font-semibold rounded-full px-3 py-1.5 border",
                        c.portal_enabled
                          ? "bg-tint-mint text-success border-[#BFE4D1]"
                          : "bg-ink-100 text-ink-500 border-ink-200"
                      )}
                    >
                      {c.portal_enabled ? "פורטל: פעיל" : "פורטל: כבוי"}
                    </ConfirmActionButton>
                    <form action={viewAsCoordinator.bind(null, c.id)}>
                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        title="פותח את האזור האישי בדיוק כפי שהיא רואה אותו"
                      >
                        <Eye size={14} /> תצוגה כרכזת
                      </Button>
                    </form>
                    {c.email && (
                      <Button size="sm" variant="secondary" onClick={() => setComposing(composing === c.id ? null : c.id)}>
                        <Mail size={14} /> שליחת מייל
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c.id)} title="עריכה">
                      <Pencil size={14} />
                    </Button>
                    <ConfirmActionButton
                      action={() => deleteContact(c.id)}
                      message={`למחוק את ${c.full_name}? חוות הדעת שכתבה יימחקו גם הן.`}
                      title="מחיקה"
                      className="inline-flex items-center justify-center rounded-lg p-2 text-ink-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </ConfirmActionButton>
                  </div>
                </div>

                {composing === c.id && <ComposeForm contact={c} onClose={() => setComposing(null)} />}

                {c.emails.length > 0 && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => setHistoryFor(historyFor === c.id ? null : c.id)}
                      className="text-[12px] font-semibold text-brand-purple hover:underline cursor-pointer"
                    >
                      {historyFor === c.id ? "הסתרת ההתכתבות" : `מיילים שנשלחו (${c.emails.length})`}
                    </button>
                    {historyFor === c.id && (
                      <div className="flex flex-col gap-2 mt-2">
                        {c.emails.map((e) => (
                          <div key={e.id} className="bg-ink-50 border border-ink-100 rounded-[10px] p-3 text-[12.5px]">
                            <div className="flex items-center gap-2 text-ink-500">
                              <span className="font-semibold text-ink-800">{e.subject || "הודעה מצוות קוד פתוח 💜"}</span>
                              <span className="ms-auto tabular-nums">{DATE_HE.format(new Date(e.created_at))}</span>
                            </div>
                            <div className="text-ink-700 whitespace-pre-wrap mt-1">{e.body}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {contacts.length === 0 && (
          <div className="bg-white border border-ink-200 rounded-[16px] p-6 text-ink-500 text-sm">
            עוד אין רכזות — הוסיפי את הראשונה למעלה 💜
          </div>
        )}
      </div>

    </div>
  );
}
