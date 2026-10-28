-- The hall screen's approved design (26/10) targets the LED: dark background, white logos.
-- Dark becomes the default; the light version stays a choice in the control panel.
alter table public.hackathon_live_settings alter column theme set default 'dark';
update public.hackathon_live_settings set theme = 'dark' where id = 1 and theme = 'light';
