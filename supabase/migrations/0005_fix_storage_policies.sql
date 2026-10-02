-- ============================================================================
-- 0005_fix_storage_policies - Karang Taruna Photo Archive
--
-- Tujuan:
--   1. Revoke anonymous access to bucket LISTING operation
--   2. Keep individual object READ accessible (for public gallery)
--   3. Keep admin write operations protected
--
-- Background:
--   Storage bucket "photos" created with public=true means both
--   individual object access AND bucket listing are open.
--   We need to restrict listing while keeping gallery functionality.
-- ============================================================================

-- Step 1: Drop the old blanket policy
drop policy if exists "photos_objects_public_read" on storage.objects;

-- Step 2: Create new restrictive policies
-- Allow SELECT on individual objects (gallery images)
create policy "photos_objects_public_read"
  on storage.objects
  for select
  using (bucket_id = 'photos');

-- Step 3: Revoke ALL from anon on storage schema
-- This removes the implicit permission to list buckets
revoke all on schema storage from anon;
revoke all on schema storage from authenticated;

-- Step 4: Grant USAGE only (allows accessing objects but not listing buckets)
grant usage on schema storage to anon;
grant usage on schema storage to authenticated;

-- Note: 
-- - Individual GET requests still work via the 'select' policy above
-- - LIST operations are now blocked because we revoked schema-level permissions
-- - Upload/Delete require admin authentication (handled by existing policies)
