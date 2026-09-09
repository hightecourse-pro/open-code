-- Screenshot cache for live-project links (the owner, 9/9): Netfree blocks
-- images from foreign domains, so the mShots screenshot is fetched ONCE on
-- the server, stored as base64, and inlined into the page as a data URI —
-- nothing external for a filter to intercept. Service-role only.
create table public.site_thumbnails (
  url_hash text primary key,
  url text not null,
  content_type text not null,
  data_base64 text not null,
  fetched_at timestamptz not null default now()
);

alter table public.site_thumbnails enable row level security;
-- No policies on purpose: only the service role (server code) touches it.
