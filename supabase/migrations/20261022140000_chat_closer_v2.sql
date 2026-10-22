-- Closer rule v2 (the owner, 22/10): her real list showed thank-yous the first
-- rule missed - "אבל תודה בכל אופן", "כן מעולה! תודה רבה!", "איזה הענות
-- מהירה:)", "וואי תודה על ההענות המהירה! וכן זה יכול לבוא בחשבון..".
-- A closer is now: no question mark, no question/request word anywhere, and
--   - starts with a closing phrase (an optional one-word lead-in: "כן מעולה!"), or
--   - says "תודה" somewhere and is not long (<= 120 chars), or
--   - is short (<= 40) and ends with a smiley / heart, or
--   - is very short (<= 12) and does not open with a question word.
create or replace function public.is_chat_closer(p_body text)
returns boolean
language sql
immutable
set search_path = public
as $$
  with t as (
    select trim(regexp_replace(
      regexp_replace(replace(coalesce(p_body, ''), '&nbsp;', ' '), '<[^>]+>', ' ', 'g'),
      '[[:space:]]+', ' ', 'g')) as txt
  )
  select coalesce((
    select position('?' in txt) = 0
      and txt !~ '(^|[^א-ת])(מתי|איך|למה|האם|איפה|כמה|אפשר|אשמח|תוכלי|תוכל|צריכה|רציתי|בבקשה)([^א-ת]|$)'
      and (
        txt ~ '^([א-ת]{1,6}[ ,!.]+)?(תודה|מעולה|סבבה|אוקי|בסדר|מצוי|יופי|מושלם|בשמחה|אין בעד מה|לילה טוב|שבת שלום|שבוע טוב|בהצלחה|מקסים|איזה כיף|כיף|נהדר|מגניב|וואו|אחלה|💜|❤|🙏|👍|😊|🥰)'
        or (length(txt) <= 120 and txt ~ '(^|[^א-ת])תודה')
        or (length(txt) <= 40 and txt ~ '(:\)|:-\)|💜|❤|🙏|👍|😊|🥰|💓|🎉|😍)[[:space:]!.]*$')
        or (length(txt) <= 12 and txt !~ '^(מה|מי |יש |אין |אולי|אפשרי|שלח|נשלח)')
      )
    from t
  ), false);
$$;
