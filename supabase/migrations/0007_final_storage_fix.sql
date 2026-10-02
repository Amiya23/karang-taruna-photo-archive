-- ============================================================================
-- 0007_final_storage_fix - Final attempt to restrict listing
-- ============================================================================

-- Drop all existing policies on storage.objects for photos bucket
drop policy if exists "photos_objects_public_read" on storage.objects;
drop policy if exists "Allow public read access 2sdgh" on storage.objects;
drop policy if exists "Allow anonymous read access" on storage.objects;
drop policy if exists "Enable insert access for authenticated users only" on storage.objects;
drop policy if exists "Enable read access for authenticated users only" on storage.objects;
drop policy if exists "Enable update for users based on user_id" on storage.objects;
drop policy if exists "Delete policy for owner" on storage.objects;

-- Create restrictive policies
-- Only allow SELECT (GET individual objects)
create policy "allow_public_read"
  on storage.objects for select
  using (bucket_id = 'photos');

-- Deny INSERT, UPDATE, DELETE to everyone except admin via RLS on photos table
-- (Storage write is already handled by app-level auth)

-- Revoke schema permissions to prevent listing
revoke all on schema storage from anon, authenticated;

-- This should make listing return 403 while individual object GET still works
-- via the 'select' policy above
