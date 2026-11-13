-- Carousel Lamp — Supabase schema v1: per-user photos.
--
-- HOW TO APPLY: Supabase dashboard → SQL Editor → New query → paste
-- this file → Run. It is idempotent (safe to run twice).
--
-- WHAT IT CREATES
--   public.photos   one row per user photo (metadata only)
--   storage bucket  `photos` for the image bytes (private)
--   Row Level Security on both, so each user sees only their own data.
--   A photo's bytes live at <user_id>/<photo_id>.<ext> in the bucket;
--   the table's storage_path holds that path. The app uploads with the
--   signed-in user's id as the first path segment, which is what the
--   storage policies check.
--   The app sets updated_at itself whenever it updates a row.

-- 1. Photos table ------------------------------------------------------------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Carousel slot, 0-15: the lamp has 16 fixed frames, one photo each.
  slot smallint not null check (slot >= 0 and slot < 16),
  storage_path text not null,
  caption text not null default '',
  caption_ai boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slot)
);

alter table public.photos enable row level security;

drop policy if exists "Users manage their own photos" on public.photos;
create policy "Users manage their own photos"
  on public.photos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists photos_user_created_idx
  on public.photos (user_id, created_at desc);

-- 2. Storage bucket + policies ----------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "Users manage their own photo files" on storage.objects;
create policy "Users manage their own photo files"
  on storage.objects for all
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
