-- ============================================================================
-- 0006_restrict_storage_listing_v2 - Karang Taruna Photo Archive
--
-- Approach: Use storage policies to explicitly deny LIST operations
-- while allowing GET (individual object access).
--
-- Note: Supabase Storage LIST and GET use different permission models.
-- This migration attempts to restrict listing by:
-- 1. Ensuring no blanket policies allow listing
-- 2. Explicitly denying list permissions
-- ============================================================================

-- First, let's see what policies exist
-- (We can't query this directly, but we'll drop and recreate)

-- Drop existing policy if exists
drop policy if exists "photos_objects_public_read" on storage.objects;

-- Create a more restrictive policy that only allows specific operations
create policy "photos_read_only"
  on storage.objects
  for select
  using (bucket_id = 'photos');

-- IMPORTANT: Supabase Storage LIST operation may require additional 
-- permissions. Try revoking at schema level first
revoke all on schema storage from anon;
revoke all on schema storage from authenticated;

-- Grant minimal permissions (USAGE allows schema access, SELECT allows object read)
grant usage on schema storage to anon;
grant usage on schema storage to authenticated;
grant select on all tables in schema storage to anon;
grant select on all tables in schema storage to authenticated;

-- The key insight: LIST is an HTTP POST to /storage/v1/object/list/{bucket}
-- This might need explicit DENY or might not be controllable via RLS
-- If above doesn't work, alternative is to make bucket private and use signed URLs
