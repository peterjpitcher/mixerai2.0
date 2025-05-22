-- Migration to drop the old brand_id column from the claims table and update RLS policies

-- Drop existing RLS policies on public.claims that might depend on the old brand_id
DROP POLICY IF EXISTS "Claims - Global Admins - Full Access" ON public.claims;
DROP POLICY IF EXISTS "Claims - Read Access" ON public.claims;
DROP POLICY IF EXISTS "Claims - Insert Access" ON public.claims;
DROP POLICY IF EXISTS "Claims - Update Access" ON public.claims;
DROP POLICY IF EXISTS "Claims - Delete Access" ON public.claims;

-- Drop the old brand_id column
ALTER TABLE public.claims
DROP COLUMN IF EXISTS brand_id CASCADE; -- Use CASCADE to handle any other lingering direct dependencies if any

-- Recreate RLS policies for public.claims

-- 1. Global Admins have full access to claims
-- This policy was defined in the original RLS migration and is being recreated here.
-- It is assumed that the helper function is_global_admin(auth.uid()) already exists from a previous migration.
-- If not, ensure it is created before this script runs.
CREATE POLICY "Claims - Global Admins - Full Access"
ON public.claims
FOR ALL
USING ( is_global_admin(auth.uid()) )
WITH CHECK ( is_global_admin(auth.uid()) );

-- 2. Read Access Policy for Claims
CREATE POLICY "Claims - Read Access"
ON public.claims
FOR SELECT
USING (
  is_global_admin(auth.uid()) OR
  ( -- Brand-level claims: tied to global_claim_brands, which are admin-managed.
    -- So, only global admins can see these directly unless part of a product/ingredient stack.
    -- For broader visibility of brand-level claims if needed, this part can be adjusted.
    -- For now, stacking logic will make them visible in context.
    claims.level = 'brand' AND claims.global_brand_id IS NOT NULL AND is_global_admin(auth.uid())
  ) OR
  ( -- Product-level claims: user has any permission for the product's brand
    claims.level = 'product' AND claims.product_id IS NOT NULL AND
    EXISTS (
      SELECT 1
      FROM public.products p
      JOIN public.user_brand_permissions ubp ON p.brand_id = ubp.brand_id
      WHERE p.id = claims.product_id
        AND ubp.user_id = auth.uid()
        -- AND ubp.role IN ('admin', 'editor', 'viewer') -- any role implies read
    )
  ) OR
  ( -- Ingredient-level claims: all authenticated users can read (ingredients are globally readable)
    claims.level = 'ingredient' AND claims.ingredient_id IS NOT NULL AND
    auth.role() = 'authenticated'
  )
);

-- 3. Insert Access Policy for Claims
CREATE POLICY "Claims - Insert Access"
ON public.claims
FOR INSERT
WITH CHECK (
  is_global_admin(auth.uid()) OR
  ( -- Brand-level claims: only global admins can create (as they manage global_claim_brands)
    claims.level = 'brand' AND claims.global_brand_id IS NOT NULL AND is_global_admin(auth.uid())
  ) OR
  ( -- Product-level claims: user is admin/editor for the product's brand
    claims.level = 'product' AND claims.product_id IS NOT NULL AND
    EXISTS (
      SELECT 1
      FROM public.products p
      JOIN public.user_brand_permissions ubp ON p.brand_id = ubp.brand_id
      WHERE p.id = claims.product_id
        AND ubp.user_id = auth.uid()
        AND ubp.role IN ('admin', 'editor')
    )
  ) OR
  ( -- Ingredient-level claims: only global admins can create (ingredients are admin-created)
    claims.level = 'ingredient' AND claims.ingredient_id IS NOT NULL AND is_global_admin(auth.uid())
  )
);

-- 4. Update Access Policy for Claims
CREATE POLICY "Claims - Update Access"
ON public.claims
FOR UPDATE
USING (
  is_global_admin(auth.uid()) OR
  (
    claims.level = 'brand' AND claims.global_brand_id IS NOT NULL AND is_global_admin(auth.uid())
  ) OR
  (
    claims.level = 'product' AND claims.product_id IS NOT NULL AND
    EXISTS (
      SELECT 1
      FROM public.products p
      JOIN public.user_brand_permissions ubp ON p.brand_id = ubp.brand_id
      WHERE p.id = claims.product_id
        AND ubp.user_id = auth.uid()
        AND ubp.role IN ('admin', 'editor')
    )
  ) OR
  (
    claims.level = 'ingredient' AND claims.ingredient_id IS NOT NULL AND is_global_admin(auth.uid())
  )
);
-- For WITH CHECK on UPDATE, we can often reuse the USING clause if the conditions for *what* can be updated
-- are the same as *who* can update them.
-- Or, be more specific if, for example, level/entity_id cannot be changed.
-- For now, keeping it symmetric with USING.

-- 5. Delete Access Policy for Claims
CREATE POLICY "Claims - Delete Access"
ON public.claims
FOR DELETE
USING (
  is_global_admin(auth.uid()) OR
  (
    claims.level = 'brand' AND claims.global_brand_id IS NOT NULL AND is_global_admin(auth.uid())
  ) OR
  (
    claims.level = 'product' AND claims.product_id IS NOT NULL AND
    EXISTS (
      SELECT 1
      FROM public.products p
      JOIN public.user_brand_permissions ubp ON p.brand_id = ubp.brand_id
      WHERE p.id = claims.product_id
        AND ubp.user_id = auth.uid()
        AND ubp.role = 'admin' -- Typically only brand admins for product can delete associated claims
    )
  ) OR
  (
    claims.level = 'ingredient' AND claims.ingredient_id IS NOT NULL AND is_global_admin(auth.uid())
  )
);

-- Ensure helper functions are available. They should be from the previous RLS migration.
-- CREATE OR REPLACE FUNCTION is_global_admin(user_id UUID) ...
-- CREATE OR REPLACE FUNCTION has_brand_permission(user_id UUID, target_brand_id UUID, allowed_roles TEXT[]) ... 