-- Add created_by to products table if it doesn't exist

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.products
    ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

    RAISE NOTICE 'Column created_by added to public.products';
  ELSE
    RAISE NOTICE 'Column created_by already exists in public.products';
  END IF;
END $$;

-- RLS policy to ensure users can only set created_by to their own ID
-- This should ideally be part of the main INSERT policy for products.
-- The current INSERT policy in 20240522180000_relink_products_to_global_claim_brands.sql
-- is simplified to Global Admin only for products linked to global_claim_brands.
-- If non-admins are allowed to create products, their specific insert policy
-- (which is currently missing/TODO in that migration) should include:
-- WITH CHECK (created_by = auth.uid() AND <other_permission_checks> )

-- For Global Admins creating products (covered by "Products - Global Admins - Full Access")
-- the created_by = auth.uid() check is implicitly handled if the API always sends the current user's ID.
-- If an admin could set created_by to *another* user, a more specific check would be needed.
-- For now, we assume the API always sets created_by to the authenticated user making the request. 