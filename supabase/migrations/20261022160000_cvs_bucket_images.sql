-- Grade sheets (Tehila Siman Tov, 19/10 → the owner 22/10): the upload form and
-- the action both accept JPG/PNG, but the "cvs" bucket only allowed PDF/Word,
-- so every photo of a grade sheet failed with "ההעלאה נכשלה". Allow images.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
]
where id = 'cvs';
