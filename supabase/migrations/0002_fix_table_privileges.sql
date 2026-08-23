-- ============================================================================
-- 0002_fix_table_privileges — Karang Taruna Photo Archive
--
-- Akar masalah 42501 "permission denied for table admin_profiles":
-- 0001 hanya me-REVOKE (hardening) dan berasumsi default privileges Supabase
-- sudah memberi akses tabel dasar ke anon/authenticated. Pada project ini
-- asumsi itu tidak berlaku, sehingga semua query via PostgREST gagal di
-- lapisan GRANT sebelum RLS dievaluasi.
--
-- Strategi 0002: DEFINISIKAN EKSPLISIT matriks privilege yang diinginkan.
-- Semua statement idempotent — aman dijalankan berulang.
-- RLS tetap menjadi enforcement layer; GRAN TIDAK mengubah siapa yang boleh
-- melihat row apa.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- admin_profiles (allowlist admin)
--   authenticated: SELECT saja — dibatasi RLS ke barisnya sendiri (id = auth.uid())
--   anon         : tidak ada apa-apa
--   DML          : tidak ada untuk siapa pun — hanya dikelola server-side
-- ----------------------------------------------------------------------------
grant select on public.admin_profiles to authenticated;

revoke select                             on public.admin_profiles from anon;
revoke insert, update, delete, truncate   on public.admin_profiles from anon;
revoke insert, update, delete, truncate   on public.admin_profiles from authenticated;

-- ----------------------------------------------------------------------------
-- archives / events / photos (konten galeri)
--   anon + authenticated: SELECT (public read, dibutuhkan gallery)
--   authenticated       : INSERT/UPDATE/DELETE — write path admin,
--                         ditoleransi/dibatasi oleh RLS is_admin()
--   anon                : tanpa DML sama sekali
-- ----------------------------------------------------------------------------

grant select on public.archives to anon, authenticated;
grant select on public.events   to anon, authenticated;
grant select on public.photos   to anon, authenticated;

grant insert, update, delete on public.archives to authenticated;
grant insert, update, delete on public.events   to authenticated;
grant insert, update, delete on public.photos   to authenticated;

revoke insert, update, delete, truncate on public.archives from anon;
revoke insert, update, delete, truncate on public.events   from anon;
revoke insert, update, delete, truncate on public.photos   from anon;

revoke truncate on public.archives from authenticated;
revoke truncate on public.events   from authenticated;
revoke truncate on public.photos   from authenticated;

-- ----------------------------------------------------------------------------
-- Storage audit (tanpa perubahan):
-- - Privilege tabel storage.objects dikelola oleh inisialisasi internal
--   Supabase Storage dan TIDAK disentuh migration ini.
-- - Policy kita pada storage.objects sudah tepat:
--     SELECT : bucket_id = 'photos'                      (public read)
--     INSERT/UPDATE/DELETE : bucket_id = 'photos' AND is_admin() (authenticated)
-- - Bucket photos: public = true (karakter konten galeri publik).
-- Tidak ada pelonggaran akses di sini.
-- ----------------------------------------------------------------------------
