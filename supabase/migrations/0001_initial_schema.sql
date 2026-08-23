-- ============================================================================
-- 0001_initial_schema — Karang Taruna Photo Archive
--
-- Source of truth untuk: tabel, explicit admin authorization, RLS,
-- dan Storage policies.
--
-- SECURITY MODEL:
--   "authenticated" TIDAK otomatis admin. Admin = baris di public.admin_profiles
--   (allowlist eksplisit yang mereferensi auth.users). Semua policy write
--   memanggil public.is_admin(). Jangan pernah mengganti ini dengan
--   raw_user_meta_data atau keanggotaan role.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger helper: menjaga updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- Allowlist admin. Dikelola HANYA dari server / SQL editor / dashboard.
-- Tidak ada policy INSERT/UPDATE/DELETE untuk role anon maupun authenticated.
create table if not exists public.admin_profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.archives (
  id          uuid primary key default gen_random_uuid(),
  year        integer not null,
  title       text not null,
  description text,
  cover_image text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint archives_year_key unique (year),
  -- Sanity check longgar: tahun dinamis apa pun boleh, bukan hanya 2023–2026
  constraint archives_year_sane check (year between 1900 and 2999)
);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  archive_id  uuid not null references public.archives (id) on delete cascade,
  name        text not null,
  description text,
  cover_image text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_archive_name_key unique (archive_id, name)
);

create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  storage_path text not null,
  filename     text not null,
  caption      text,
  taken_at     timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint photos_storage_path_key unique (storage_path)
);

-- Satu archive_id bisa punya banyak event; unique(archive_id, name) sudah
-- menjadi index leading-column untuk lookup by archive.
create index if not exists idx_events_archive_id
  on public.events (archive_id);

create index if not exists idx_photos_event_created
  on public.photos (event_id, created_at);

create or replace trigger set_updated_at_admin_profiles
  before update on public.admin_profiles
  for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_archives
  before update on public.archives
  for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_events
  before update on public.events
  for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_photos
  before update on public.photos
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- is_admin() — single authorization primitive
--
-- SECURITY DEFINER:
--   - fungsi berjalan sebagai owner -> melewati RLS admin_profiles,
--     sehingga tidak ada rekursi policy pada tabel itu sendiri.
-- SET search_path = '':
--   - semua referensi fully-qualified, imun terhadap search_path hijacking
--     (rekomendasi hardening Supabase).
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- RLS: enable di SEMUA tabel
-- ----------------------------------------------------------------------------
alter table public.admin_profiles enable row level security;
alter table public.archives       enable row level security;
alter table public.events         enable row level security;
alter table public.photos         enable row level security;

-- admin_profiles: admin hanya boleh melihat barisnya sendiri.
-- SENGAJA tidak ada policy INSERT/UPDATE/DELETE di sini:
-- tidak ada jalur bagi siapa pun (termasuk authenticated) untuk
-- menambahkan dirinya sebagai admin via API. Penambahan admin hanya
-- melalui SQL editor / service-role oleh pemilik project.
create policy "admin_profiles_select_own"
  on public.admin_profiles
  for select to authenticated
  using (id = auth.uid());

-- Konten publik: SELECT terbuka (seluruh isi arsip adalah konten galeri publik)
create policy "archives_public_select" on public.archives
  for select using (true);

create policy "events_public_select" on public.events
  for select using (true);

create policy "photos_public_select" on public.photos
  for select using (true);

-- Konten: write penuh HANYA untuk allowlist admin.
-- authenticated non-admin hanya mewarisi policy SELECT di atas.
create policy "archives_admin_all" on public.archives
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "events_admin_all" on public.events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "photos_admin_all" on public.photos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Hardening grant: anon sama sekali tidak punya privilege DML.
-- (RLS saja sudah menolak, ini lapisan kedua.)
revoke insert, update, delete, truncate on public.admin_profiles from anon, authenticated;
revoke select on public.admin_profiles from anon;
revoke insert, update, delete, truncate on public.archives from anon;
revoke insert, update, delete, truncate on public.events   from anon;
revoke insert, update, delete, truncate on public.photos   from anon;

-- ----------------------------------------------------------------------------
-- Storage: bucket photos + policies
--
-- Path convention {year}/{event_id}/{timestamp}-{sanitized-filename} dipakai
-- di application layer untuk KERAPIAN saja — path BUKAN mekanisme security;
-- otorisasi murni lewat policy bucket + is_admin() di bawah.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Public read: sesuai karakter bucket public (galeri dapat dilihat siapa saja)
create policy "photos_objects_public_read"
  on storage.objects
  for select
  using (bucket_id = 'photos');

-- Write: HANYA admin allowlist. Tidak ada INSERT/UPDATE/DELETE umum
-- untuk role authenticated.
create policy "photos_objects_admin_insert"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and public.is_admin()
  );

create policy "photos_objects_admin_update"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and public.is_admin()
  )
  with check (
    bucket_id = 'photos'
    and public.is_admin()
  );

create policy "photos_objects_admin_delete"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and public.is_admin()
  );
