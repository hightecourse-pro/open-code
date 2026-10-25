-- AutoHotkey scripts in the forum (the owner, 25/10): an .ahk file is plain
-- text; the browser hands it over with an empty or generic MIME type, so the
-- app stores it as text/plain - the bucket has to allow that type.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets
       set allowed_mime_types = array[
             'image/png', 'image/jpeg', 'image/webp', 'image/gif',
             'application/pdf',
             'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             'text/plain'
           ]
     where id = 'attachments';
  end if;
end $$;
