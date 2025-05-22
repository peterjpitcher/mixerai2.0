-- Migration: Add created_by column to claims table

BEGIN;

-- 1. Add the created_by column to the public.claims table
ALTER TABLE public.claims
ADD COLUMN created_by UUID;

-- 2. Add a foreign key constraint to auth.users table
-- This assumes that most claims will be created by authenticated users.
-- ON DELETE SET NULL means if the creating user is deleted, the claim's created_by field will become NULL.
ALTER TABLE public.claims
ADD CONSTRAINT fk_claims_created_by
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Add a comment to the new column for documentation
COMMENT ON COLUMN public.claims.created_by IS 'Tracks the user ID of the user who originally created the claim. References auth.users.';

-- 4. Optional: Update existing RLS policies if needed to reference created_by
-- This step is deferred for now, as existing policies are brand-permission based.
-- Example (if you wanted users to manage their own claims):
-- ALTER POLICY "Allow authenticated users to read claims" ON public.claims
-- FOR SELECT USING (auth.uid() = created_by OR is_global_admin() OR has_brand_permission_for_claim(id));

COMMIT;

-- Informational message (will appear in Supabase dashboard if run through CLI)
SELECT 'Migration 00X_add_created_by_to_claims.sql completed successfully.'; 