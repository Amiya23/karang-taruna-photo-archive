-- ============================================================================
-- 0003_homepage_settings — Karang Taruna Photo Archive
--
-- Singleton homepage configuration so admins can pick exactly 3 photos for the
-- public Hero collage via Admin -> Pengaturan.
--
-- DESIGN:
--   - Single row, fixed PK, so there is exactly ONE source of truth.
--   - We store ONLY photo IDs (UUID), never storage_path / URLs / credentials.
--   - Public SELECT (hero config is non-sensitive). Admin-only write via is_admin().
--   - Reuses the existing is_admin() authorization primitive and RLS pattern
--     from 0001/0002. No service-role workaround, no new auth mechanism.
-- ============================================================================

create table if not exists public.homepage_settings (
  id               uuid primary key default '00000000-0000-0000-0000-000000000001',
  hero_photo_1_id  uuid,
  hero_photo_2_id  uuid,
  hero_photo_3_id  uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Keep a single row: id is fixed, so an insert collides and we upsert instead.
create index if not exists idx_homepage_settings_single
  on public.homepage_settings (id);

create or replace trigger set_updated_at_homepage_settings
  before update on public.homepage_settings
  for each row execute function public.set_updated_at();

alter table public.homepage_settings enable row level security;

-- Public read: hero photo IDs are non-sensitive (only references existing public photos).
create policy "homepage_settings_public_select"
  on public.homepage_settings
  for select using (true);

-- Write: admin allowlist only (mirrors archives/events/photos pattern).
create policy "homepage_settings_admin_all"
  on public.homepage_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Grants: public read; authenticated DML gated by RLS is_admin().
grant select on public.homepage_settings to anon, authenticated;
grant insert, update, delete on public.homepage_settings to authenticated;

revoke insert, update, delete, truncate on public.homepage_settings from anon;
revoke truncate on public.homepage_settings from authenticated;
