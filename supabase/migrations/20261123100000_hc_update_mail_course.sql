-- הייטקורס 2026 - the per-course update mail remembers WHICH course it was written
-- for (the owner, 23/11: ״מי שאתה רואה בגליון שעברה לקורס אחר ממה שנשלח לה - שלח
-- לה את המייל של הקורס״). A participant moved to another course in the sheet after
-- her mail went out gets the new course's mail from the next tick; until now the
-- row only said "sent" and the course at send time was unknowable.
alter table public.hc_preconf_participants
  add column if not exists update_mail_course text;

-- Everyone already mailed was mailed for the course she is in now (the one
-- proven move, row 325, was re-mailed by hand before this migration).
update public.hc_preconf_participants
   set update_mail_course = course
 where update_mail_course is null
   and update_mail_status in ('sent', 'blocked');
