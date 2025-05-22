-- Migration to relink products to global_claim_brands

-- Step 1: Add the new global_brand_id column to the products table
ALTER TABLE public.products
ADD COLUMN global_brand_id UUID REFERENCES public.global_claim_brands(id) ON DELETE SET NULL; -- Or ON DELETE CASCADE

-- Step 2: Data migration (IMPORTANT - placeholder)
-- If you have existing products, you need a strategy to map them.
-- For example, if there's a mapping from old brand_id to new global_brand_id:
-- UPDATE public.products p SET global_brand_id = (SELECT gcb.id FROM global_claim_brands gcb JOIN brands b ON gcb.name = b.name WHERE b.id = p.brand_id)
-- THIS IS A COMPLEX, DATA-DEPENDENT OPERATION AND THE ABOVE IS A MERE ILLUSTRATION.
-- For now, this script assumes new products or that data migration is handled separately.

-- Step 3: Drop the old brand_id column
-- First, drop policies that depend on products.brand_id
DROP POLICY IF EXISTS "Products - Global Admins - Full Access" ON public.products;
DROP POLICY IF EXISTS "Products - Brand Users - Select Access" ON public.products;
DROP POLICY IF EXISTS "Products - Brand Admin/Editor - Insert Access" ON public.products;
DROP POLICY IF EXISTS "Products - Brand Admin/Editor - Update Access" ON public.products;
DROP POLICY IF EXISTS "Products - Brand Admin - Delete Access" ON public.products;

-- Now drop the column
ALTER TABLE public.products
DROP COLUMN IF EXISTS brand_id CASCADE;

-- Step 4: Update RLS policies for products
-- Since global_claim_brands are admin-managed, linking products to them
-- changes the permission model.
-- The policies below are a simplification and may need adjustment.

-- 4.1. Global Admins have full access to products
CREATE POLICY "Products - Global Admins - Full Access"
ON public.products
FOR ALL
USING ( is_global_admin(auth.uid()) )
WITH CHECK ( is_global_admin(auth.uid()) );

-- 4.2. Authenticated users can read all products (simplification)
-- This might be too permissive or not permissive enough depending on your needs.
-- Previously, it checked user_brand_permissions via the old brand_id.
CREATE POLICY "Products - Authenticated Users - Read Access"
ON public.products
FOR SELECT
USING ( auth.role() = 'authenticated' );

-- TODO: Define more granular INSERT, UPDATE, DELETE policies if non-admins
-- need to manage products linked to global_claim_brands.
-- This might involve new permission structures or linking global_claim_brands to user permissions.

-- Step 5: Ensure the products table has RLS enabled
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY; 