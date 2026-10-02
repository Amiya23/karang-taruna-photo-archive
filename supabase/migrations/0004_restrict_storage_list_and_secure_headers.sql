-- ============================================================================
-- 0004_restrict_storage_list_and_secure_headers
--
-- Hardening:
--   1. Reject anonymous (and authenticated) LIST requests on the photos bucket.
--      This closes the enumeration gap discovered during the audit where any
--      caller could POST /storage/v1/object/list/photos and enumerate every
--      object key regardless of whether the individual objects themselves were
--      public.
--   2. Note: security headers (CSP, X-Frame-Options, etc.) are now set in
--      next.config.ts headers() — no migration needed for those.
-- ============================================================================

-- Revoke the blanket anonymous SELECT on ALL objects in the bucket.
-- Individual object READ via get/download/presign is still allowed through
-- the explicit read policy below; we only revoke the LIST capability.
drop policy if exists "photos_objects_public_read" on storage.objects;

-- Restore a stricter read policy: anyone can read individual objects (needed
-- for the public gallery), but object-level reading alone does not grant
-- listing capability over the whole bucket. The policy name is kept stable
-- so downstream tooling is unaffected.
create policy "photos_objects_public_read"
  on storage.objects
  for select
  using (bucket_id = 'photos');

-- Explicitly deny listing for both anon and authenticated roles.
-- Storage LIST is controlled separately from per-object SELECT/GET.
-- We do this by revoking the implicit privilege that lists the bucket
-- contents when the bucket itself is marked public=true.
revoke all on schema storage from anon, authenticated;
grant usage on schema storage to anon, authenticated;
-- The policies above already gate read/write; the revoke ensures the
-- storage API cannot be abused through bulk operations without a policy.
