-- Migration: Add Global Claim Brands and Update Claims Table

-- Ensure moddatetime function exists for auto-updating updated_at columns
CREATE OR REPLACE FUNCTION moddatetime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure is_global_admin function exists for RLS policies
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT auth.jwt()->>'user_metadata'->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Create the global_claim_brands table
CREATE TABLE public.global_claim_brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS for global_claim_brands
ALTER TABLE public.global_claim_brands ENABLE ROW LEVEL SECURITY;

-- Comment on table and columns
COMMENT ON TABLE public.global_claim_brands IS 'Stores global, non-country-specific brand entities for use in claims management.';
COMMENT ON COLUMN public.global_claim_brands.id IS 'Unique identifier for the global claim brand.';
COMMENT ON COLUMN public.global_claim_brands.name IS 'Name of the global claim brand (e.g., "Häagen-Dazs", "Betty Crocker"). Must be unique.';
COMMENT ON COLUMN public.global_claim_brands.created_at IS 'Timestamp of when the global claim brand was created.';
COMMENT ON COLUMN public.global_claim_brands.updated_at IS 'Timestamp of when the global claim brand was last updated.';

-- Trigger to update "updated_at" timestamp
CREATE TRIGGER handle_updated_at_global_claim_brands
BEFORE UPDATE ON public.global_claim_brands
FOR EACH ROW
EXECUTE FUNCTION moddatetime (updated_at);

-- 2. Add global_brand_id to the claims table
ALTER TABLE public.claims
ADD COLUMN global_brand_id UUID REFERENCES public.global_claim_brands(id) ON DELETE SET NULL;

-- Comment on the new column
COMMENT ON COLUMN public.claims.global_brand_id IS 'Reference to a global_claim_brand. Used when claim level is "brand".';

-- 3. RLS Policies for global_claim_brands

-- Global admins can do anything
CREATE POLICY "Allow global admins full access on global_claim_brands"
ON public.global_claim_brands
FOR ALL
USING (is_global_admin())
WITH CHECK (is_global_admin());

-- Authenticated users can read global claim brands
CREATE POLICY "Allow authenticated users to read global_claim_brands"
ON public.global_claim_brands
FOR SELECT
USING (auth.role() = 'authenticated');

-- Ensure the helper function is_global_admin() exists.
-- If it doesn't, it would have been created in a previous migration.
-- We assume it checks something like: auth.jwt()->>'user_metadata'->>'role' = 'admin'

-- Example of how existing claims might need adjustment if any were 'brand' level
-- This is illustrative and depends on how existing brand-level claims were handled.
-- If existing brand-level claims used the original 'brand_id' (pointing to country-specific brands)
-- and you want to migrate them, that would be a separate, more complex data migration step.
-- For now, new brand-level claims will use 'global_brand_id'.

-- Make sure brand_id is nullable if it isn't already,
-- as brand-level claims will now use global_brand_id.
-- If claims.brand_id was NOT NULL, this would be an issue for brand-level claims.
-- However, based on the previous claims schema, brand_id, product_id, ingredient_id were already nullable.

-- Consider adding a CHECK constraint to ensure that if level = 'brand', then global_brand_id is NOT NULL
-- and product_id and ingredient_id ARE NULL.
-- And similar checks for product and ingredient levels.
-- For now, this logic will be handled in the API/application layer.

ALTER TABLE public.claims
  ADD CONSTRAINT check_claim_level_ids
  CHECK (
    (level = 'brand' AND global_brand_id IS NOT NULL AND product_id IS NULL AND ingredient_id IS NULL) OR
    (level = 'product' AND product_id IS NOT NULL AND global_brand_id IS NULL) OR -- Retain brand_id (country-specific) for product context if needed
    (level = 'ingredient' AND ingredient_id IS NOT NULL AND global_brand_id IS NULL) -- Retain brand_id/product_id for ingredient context if needed
  );

-- Note: The above constraint needs careful consideration.
-- For product-level claims, `brand_id` (the original one linking to country-specific brands) is still relevant
-- to know which country-specific brand the product belongs to.
-- For ingredient-level claims, `product_id` and/or `brand_id` might be relevant.
-- The constraint above for 'product' and 'ingredient' ensures global_brand_id IS NULL for them.

-- A simpler constraint if we only care about global_brand_id for brand-level claims:
-- ALTER TABLE public.claims
--   ADD CONSTRAINT check_brand_level_uses_global_brand_id
--   CHECK (
--     (level = 'brand' AND global_brand_id IS NOT NULL) OR
--     (level <> 'brand')
--   );
-- And ensure that if level = 'brand', product_id and ingredient_id are null via API logic.

-- Let's refine the CHECK constraint to be more accurate:
-- If level is 'brand', global_brand_id must be set, and product_id/ingredient_id must be null.
-- If level is 'product', product_id must be set. global_brand_id must be null. brand_id (country-specific) links the product.
-- If level is 'ingredient', ingredient_id must be set. global_brand_id must be null. product_id/brand_id links the ingredient.

-- First, drop the previous attempt if it was applied
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'check_claim_level_ids') THEN
    ALTER TABLE public.claims DROP CONSTRAINT check_claim_level_ids;
  END IF;
END $$;

-- New constraint
ALTER TABLE public.claims
  ADD CONSTRAINT "chk_claim_ids_based_on_level"
  CHECK (
    (level = 'brand' AND global_brand_id IS NOT NULL AND product_id IS NULL AND ingredient_id IS NULL AND brand_id IS NULL) OR
    (level = 'product' AND product_id IS NOT NULL AND global_brand_id IS NULL AND brand_id IS NOT NULL) OR -- product must belong to a country-specific brand
    (level = 'ingredient' AND ingredient_id IS NOT NULL AND global_brand_id IS NULL) -- ingredient can be standalone, or linked to product/brand via app logic if needed
  );

COMMENT ON CONSTRAINT "chk_claim_ids_based_on_level" ON public.claims
IS 'Ensures that appropriate ID fields are populated based on the claim level. For brand-level claims, global_brand_id is used and others are null. For product-level, product_id and its associated country-specific brand_id are used, global_brand_id is null. For ingredient-level, ingredient_id is used, global_brand_id is null.';


SELECT 'Migration 00X_add_global_claim_brands completed successfully.'; 