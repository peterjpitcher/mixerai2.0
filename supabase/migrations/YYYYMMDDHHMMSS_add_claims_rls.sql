-- supabase/migrations/YYYYMMDDHHMMSS_add_claims_rls.sql
-- Replace YYYYMMDDHHMMSS with the actual timestamp

-- Enable RLS for all new tables
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- RLS Policies for: public.ingredients
--------------------------------------------------------------------------------

-- 1. Global Admins have full access to ingredients
DROP POLICY IF EXISTS "Ingredients - Global Admins - Full Access" ON public.ingredients;
CREATE POLICY "Ingredients - Global Admins - Full Access"
ON public.ingredients
FOR ALL
USING ( (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin' )
WITH CHECK ( (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin' );

-- 2. Authenticated users can read all ingredients
DROP POLICY IF EXISTS "Ingredients - Authenticated Users - Read Access" ON public.ingredients;
CREATE POLICY "Ingredients - Authenticated Users - Read Access"
ON public.ingredients
FOR SELECT
USING ( auth.role() = 'authenticated' );

-- Note: CUD for ingredients is currently restricted to Global Admins.
-- If other roles need CUD, additional policies or a different approach for ingredient management would be required.

--------------------------------------------------------------------------------
-- RLS Policies for: public.products
--------------------------------------------------------------------------------

-- 1. Global Admins have full access to products
DROP POLICY IF EXISTS "Products - Global Admins - Full Access" ON public.products;
CREATE POLICY "Products - Global Admins - Full Access"
ON public.products
FOR ALL
USING ( (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin' )
WITH CHECK ( (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin' );

-- 2. Users can SELECT products if they have any permission for the product's brand.
DROP POLICY IF EXISTS "Products - Brand Users - Select Access" ON public.products;
CREATE POLICY "Products - Brand Users - Select Access"
ON public.products
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_brand_permissions ubp
    WHERE ubp.user_id = auth.uid()
      AND ubp.brand_id = products.brand_id
  )
);

-- 3. Users can INSERT products if they are an 'admin' or 'editor' for the product's brand.
DROP POLICY IF EXISTS "Products - Brand Admin/Editor - Insert Access" ON public.products;
CREATE POLICY "Products - Brand Admin/Editor - Insert Access"
ON public.products
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_brand_permissions ubp
    WHERE ubp.user_id = auth.uid()
      AND ubp.brand_id = products.brand_id
      AND ubp.role IN ('admin', 'editor')
  )
);

-- 4. Users can UPDATE products if they are an 'admin' or 'editor' for the product's brand.
DROP POLICY IF EXISTS "Products - Brand Admin/Editor - Update Access" ON public.products;
CREATE POLICY "Products - Brand Admin/Editor - Update Access"
ON public.products
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_brand_permissions ubp
    WHERE ubp.user_id = auth.uid()
      AND ubp.brand_id = products.brand_id
      AND ubp.role IN ('admin', 'editor')
  )
);

-- 5. Users can DELETE products if they are an 'admin' for the product's brand.
DROP POLICY IF EXISTS "Products - Brand Admin - Delete Access" ON public.products;
CREATE POLICY "Products - Brand Admin - Delete Access"
ON public.products
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_brand_permissions ubp
    WHERE ubp.user_id = auth.uid()
      AND ubp.brand_id = products.brand_id
      AND ubp.role = 'admin'
  )
);


--------------------------------------------------------------------------------
-- RLS Policies for: public.product_ingredients
--------------------------------------------------------------------------------

-- 1. Global Admins have full access to product_ingredients
DROP POLICY IF EXISTS "ProductIngredients - Global Admins - Full Access" ON public.product_ingredients;
CREATE POLICY "ProductIngredients - Global Admins - Full Access"
ON public.product_ingredients
FOR ALL
USING ( (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin' )
WITH CHECK ( (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin' );

-- 2. Users can SELECT product_ingredients if they can select the associated product.
DROP POLICY IF EXISTS "ProductIngredients - Product Readers - Select Access" ON public.product_ingredients;
CREATE POLICY "ProductIngredients - Product Readers - Select Access"
ON public.product_ingredients
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.user_brand_permissions ubp ON p.brand_id = ubp.brand_id
    WHERE p.id = product_ingredients.product_id
      AND ubp.user_id = auth.uid()
  )
);

-- 3. Users can INSERT/DELETE product_ingredients if they are 'admin' or 'editor' for the associated product's brand.
-- (Update is not typical for junction tables; it's usually delete + insert)
DROP POLICY IF EXISTS "ProductIngredients - Product Admin/Editor - Modify Access" ON public.product_ingredients;
CREATE POLICY "ProductIngredients - Product Admin/Editor - Modify Access"
ON public.product_ingredients
FOR ALL -- Covers INSERT and DELETE. Update is less common for junction, but included.
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.user_brand_permissions ubp ON p.brand_id = ubp.brand_id
    WHERE p.id = product_ingredients.product_id
      AND ubp.user_id = auth.uid()
      AND ubp.role IN ('admin', 'editor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.user_brand_permissions ubp ON p.brand_id = ubp.brand_id
    WHERE p.id = product_ingredients.product_id
      AND ubp.user_id = auth.uid()
      AND ubp.role IN ('admin', 'editor')
  )
);


--------------------------------------------------------------------------------
-- RLS Policies for: public.claims
--------------------------------------------------------------------------------

-- Helper function to check if user is Global Admin
CREATE OR REPLACE FUNCTION is_global_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = user_id) = 'admin';
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to check brand permission
CREATE OR REPLACE FUNCTION has_brand_permission(user_id UUID, target_brand_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_brand_permissions
    WHERE user_brand_permissions.user_id = user_id
      AND user_brand_permissions.brand_id = target_brand_id
      AND user_brand_permissions.role::TEXT = ANY(allowed_roles)
  );
$$ LANGUAGE SQL SECURITY DEFINER;


-- 1. Global Admins have full access to claims
DROP POLICY IF EXISTS "Claims - Global Admins - Full Access" ON public.claims;
CREATE POLICY "Claims - Global Admins - Full Access"
ON public.claims
FOR ALL
USING ( is_global_admin(auth.uid()) )
WITH CHECK ( is_global_admin(auth.uid()) );

-- SELECT Policies for Claims
DROP POLICY IF EXISTS "Claims - Read Access" ON public.claims;
CREATE POLICY "Claims - Read Access"
ON public.claims
FOR SELECT
USING (
  is_global_admin(auth.uid()) OR
  ( -- Brand-level claims: user has any role in that brand
    claims.level = 'brand' AND claims.brand_id IS NOT NULL AND
    has_brand_permission(auth.uid(), claims.brand_id, ARRAY['admin', 'editor', 'viewer'])
  ) OR
  ( -- Product-level claims: user has any role in the product's brand
    claims.level = 'product' AND claims.product_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = claims.product_id
      AND has_brand_permission(auth.uid(), p.brand_id, ARRAY['admin', 'editor', 'viewer'])
    )
  ) OR
  ( -- Ingredient-level claims: any authenticated user can read
    claims.level = 'ingredient' AND auth.role() = 'authenticated'
  )
);

-- INSERT Policies for Claims
DROP POLICY IF EXISTS "Claims - Insert Access" ON public.claims;
CREATE POLICY "Claims - Insert Access"
ON public.claims
FOR INSERT
WITH CHECK (
  is_global_admin(auth.uid()) OR
  ( -- Brand-level claims: user is 'admin' or 'editor' for that brand
    claims.level = 'brand' AND claims.brand_id IS NOT NULL AND
    has_brand_permission(auth.uid(), claims.brand_id, ARRAY['admin', 'editor'])
  ) OR
  ( -- Product-level claims: user is 'admin' or 'editor' for the product's brand
    claims.level = 'product' AND claims.product_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = claims.product_id
      AND has_brand_permission(auth.uid(), p.brand_id, ARRAY['admin', 'editor'])
    )
  )
  -- Ingredient-level claims: Only Global Admins can insert (covered by the first OR condition)
);

-- UPDATE Policies for Claims
DROP POLICY IF EXISTS "Claims - Update Access" ON public.claims;
CREATE POLICY "Claims - Update Access"
ON public.claims
FOR UPDATE
USING ( -- User must have had permission to insert it to update it (simplified)
  is_global_admin(auth.uid()) OR
  ( 
    claims.level = 'brand' AND claims.brand_id IS NOT NULL AND
    has_brand_permission(auth.uid(), claims.brand_id, ARRAY['admin', 'editor'])
  ) OR
  ( 
    claims.level = 'product' AND claims.product_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = claims.product_id
      AND has_brand_permission(auth.uid(), p.brand_id, ARRAY['admin', 'editor'])
    )
  )
  -- Ingredient-level claims: Only Global Admins can update
);

-- DELETE Policies for Claims
DROP POLICY IF EXISTS "Claims - Delete Access" ON public.claims;
CREATE POLICY "Claims - Delete Access"
ON public.claims
FOR DELETE
USING ( -- User must have admin rights for the respective entity or be global admin
  is_global_admin(auth.uid()) OR
  ( 
    claims.level = 'brand' AND claims.brand_id IS NOT NULL AND
    has_brand_permission(auth.uid(), claims.brand_id, ARRAY['admin'])
  ) OR
  ( 
    claims.level = 'product' AND claims.product_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = claims.product_id
      AND has_brand_permission(auth.uid(), p.brand_id, ARRAY['admin'])
    )
  )
  -- Ingredient-level claims: Only Global Admins can delete
); 