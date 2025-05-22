import { CLAIM_COUNTRY_GLOBAL } from '@/lib/constants';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { ClaimType, ClaimLevel } from '../app/api/claims/route'; // Adjusted path

// Interfaces based on database schema & query needs
// Note: Supabase auto-generated types should ideally be used if they align perfectly or can be extended.
// For now, defining explicitly for clarity in this utility.

interface Product {
  id: string;
  name: string;
  brand_id: string;
  // brands: { name: string } | null; // If joined like in API routes
}

interface Ingredient {
  id: string;
  name: string;
}

interface ProductIngredient {
  product_id: string;
  ingredient_id: string;
  // ingredients?: Ingredient; // If joined
}

// Base Claim interface matching the DB table structure closely
export interface DbClaim {
  id: string;
  claim_text: string;
  description: string | null;
  claim_type: ClaimType;
  level: ClaimLevel;
  global_brand_id?: string | null;
  product_id?: string | null;
  ingredient_id?: string | null;
  country_code: string;
  created_by: string | null; // Can be null if created by a system process or if user is deleted
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

// Represents a claim as it would appear in the stacked list, with info about its source
export interface StackedClaim extends DbClaim {
  source_entity_id: string; // ID of the brand, product, or ingredient this claim directly refers to
  source_entity_name?: string; // Optional: name of the source entity for display
  origin_level: ClaimLevel; // The level this claim originated from (brand, product, ingredient)
  is_country_specific: boolean; // True if this claim was for the targetCountryCode, false if it was a CLAIM_COUNTRY_GLOBAL fallback
}

/**
 * Fetches and aggregates all relevant claims for a given product and country context.
 *
 * @param productId The ID of the product to fetch claims for.
 * @param targetCountryCode The ISO country code, or CLAIM_COUNTRY_GLOBAL for global context.
 * @returns Promise<StackedClaim[]>
 */
export async function getStackedClaimsForProduct(
  productId: string,
  targetCountryCode: string,
): Promise<StackedClaim[]> {
  console.log(`[claims-utils] Getting stacked claims for product: ${productId}, country: ${targetCountryCode}`);
  const supabase = createSupabaseAdminClient();

  // 1. Fetch the product details (to get its global_brand_id and name)
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, global_brand_id, global_claim_brands (id, name)') // Corrected to use global_brand_id and global_claim_brands
    .eq('id', productId)
    .single();

  if (productError) {
    console.error(`[claims-utils] Error fetching product ${productId}:`, productError);
    throw productError;
  }
  if (!product) {
    console.error(`[claims-utils] Product not found: ${productId}`);
    return [];
  }
  const brandId = product.global_brand_id; // Corrected to use global_brand_id
  const brandName = product.global_claim_brands?.name || 'Unknown Brand'; // Corrected to use global_claim_brands

  // 2. Fetch product_ingredients for the product to get ingredient IDs and names
  const { data: productIngredientsData, error: piError } = await supabase
    .from('product_ingredients')
    .select('ingredient_id, ingredients (id, name)') // Assuming ingredients table for ingredient name
    .eq('product_id', productId);

  if (piError) {
    console.error(`[claims-utils] Error fetching ingredients for product ${productId}:`, piError);
    throw piError; // Or handle more gracefully
  }
  const ingredients = productIngredientsData?.map(pi => pi.ingredients as Ingredient).filter(Boolean) || [];
  const ingredientIds = ingredients.map(ing => ing.id);

  // 3. Fetch all potentially relevant claims in a single query
  // Claims for the specific product, its brand (if brandId exists), and its ingredients
  let orConditions = [`product_id.eq.${productId}`];
  if (brandId) {
    orConditions.push(`global_brand_id.eq.${brandId}`);
  }
  if (ingredientIds.length > 0) {
    orConditions.push(`ingredient_id.in.(${ingredientIds.join(',')})`);
  }
  
  let claimsQuery = supabase
    .from('claims')
    .select('*') // Select all claim fields
    .in('country_code', [targetCountryCode, CLAIM_COUNTRY_GLOBAL])
    .or(orConditions.join(','));
  
  const { data, error: claimsError } = await claimsQuery;
  const allRelevantClaims: DbClaim[] = data as DbClaim[] || [];

  if (claimsError) {
    console.error(`[claims-utils] Error fetching claims for product ${productId}:`, claimsError);
    throw claimsError;
  }
  if (!allRelevantClaims) return [];

  const result: StackedClaim[] = [];
  // Using a Set to track added claim combinations (text + level + entityId + country_specificity) to avoid functional duplicates in stacking
  const addedClaimSignatures = new Set<string>();

  const processAndAddClaims = (claims: DbClaim[], level: ClaimLevel, entityId: string, entityName: string | undefined) => {
    const countrySpecificClaims = claims.filter(c => c.country_code === targetCountryCode && c.level === level && 
        ((level === 'brand' && c.global_brand_id === entityId) || 
         (level === 'product' && c.product_id === entityId) || 
         (level === 'ingredient' && c.ingredient_id === entityId)));
    
    const globalClaims = claims.filter(c => c.country_code === CLAIM_COUNTRY_GLOBAL && c.level === level && 
        ((level === 'brand' && c.global_brand_id === entityId) || 
         (level === 'product' && c.product_id === entityId) || 
         (level === 'ingredient' && c.ingredient_id === entityId)));

    countrySpecificClaims.forEach(claim => {
        const signature = `${claim.claim_text}|${level}|${entityId}|country`;
        if (!addedClaimSignatures.has(signature)) {
            result.push({ 
                ...claim, 
                source_entity_id: entityId, 
                source_entity_name: entityName, 
                origin_level: level, 
                is_country_specific: true 
            });
            addedClaimSignatures.add(signature);
        }
    });

    globalClaims.forEach(claim => {
        const countrySpecificOverrideExists = result.some(rc => 
            rc.claim_text === claim.claim_text && 
            rc.origin_level === level && 
            rc.source_entity_id === entityId && 
            rc.is_country_specific
        );
        const signature = `${claim.claim_text}|${level}|${entityId}|global`;
        if (!countrySpecificOverrideExists && !addedClaimSignatures.has(signature)) {
             result.push({ 
                ...claim, 
                source_entity_id: entityId, 
                source_entity_name: entityName, 
                origin_level: level, 
                is_country_specific: false 
            });
            addedClaimSignatures.add(signature);
        }
    });
  };

  // 4. Consolidate claims based on hierarchy (Product > Ingredients > Brand)
  // Process Product Level Claims
  processAndAddClaims(allRelevantClaims, 'product', productId, product.name);

  // Process Ingredient Level Claims
  for (const ingredient of ingredients) {
    processAndAddClaims(allRelevantClaims, 'ingredient', ingredient.id, ingredient.name);
  }

  // Process Brand Level Claims (only if brandId is available)
  if (brandId && brandName) {
    processAndAddClaims(allRelevantClaims, 'brand', brandId, brandName);
  }
  
  console.log(`[claims-utils] Found ${result.length} stacked claims for product ${productId} in ${targetCountryCode}.`);
  // The result might have multiple claims from the same level (e.g. multiple global brand claims).
  // The UI or AI will need to handle this. The key is that country-specific are prioritized over global for the *same claim text*.
  // If the business rule is one claim type (e.g. 'allowed') per text per source, further filtering is needed here or in UI.
  return result;
}


/**
 * Fetches ALL claims associated with a brand, including its products and their ingredients.
 * @param brandId The ID of the brand.
 * @returns Promise<DbClaim[]>
 */
export async function getAllClaimsForBrand(brandId: string): Promise<DbClaim[]> {
  console.log(`[claims-utils] Getting ALL claims for brand: ${brandId}`);
  const supabase = createSupabaseAdminClient();
  const allClaimsForBrand: DbClaim[] = [];

  // 1. Brand-level claims for the given brand
  // Assuming brandId here refers to global_claim_brands.id for consistency with product claims logic
  const { data: brandClaims, error: brandClaimsError } = await supabase
    .from('claims')
    .select('*')
    .eq('level', 'brand')
    .eq('global_brand_id', brandId); // Changed from brand_id to global_brand_id
  if (brandClaimsError) throw brandClaimsError;
  if (brandClaims) allClaimsForBrand.push(...brandClaims as DbClaim[]);

  // 2. Get all product IDs for this brand (global_claim_brand)
  const { data: brandProducts, error: brandProductsError } = await supabase
    .from('products')
    .select('id')
    .eq('global_brand_id', brandId); // Changed from brand_id to global_brand_id
  if (brandProductsError) throw brandProductsError;
  
  if (brandProducts && brandProducts.length > 0) {
    const brandProductIds = brandProducts.map(p => p.id);

    // 3. Product-level claims for these products
    const { data: productLevelClaims, error: productClaimsError } = await supabase
      .from('claims')
      .select('*')
      .eq('level', 'product')
      .in('product_id', brandProductIds);
    if (productClaimsError) throw productClaimsError;
    if (productLevelClaims) allClaimsForBrand.push(...productLevelClaims as DbClaim[]);

    // 4. Get all unique ingredient IDs for these products
    const { data: productIngredients, error: piError } = await supabase
      .from('product_ingredients')
      .select('ingredient_id')
      .in('product_id', brandProductIds);
    if (piError) throw piError;

    if (productIngredients && productIngredients.length > 0) {
      const uniqueIngredientIds = Array.from(new Set(productIngredients.map(pi => pi.ingredient_id)));
      
      if (uniqueIngredientIds.length > 0) {
        // 5. Ingredient-level claims for these unique ingredients
        const { data: ingredientLevelClaims, error: ingredientClaimsError } = await supabase
          .from('claims')
          .select('*')
          .eq('level', 'ingredient')
          .in('ingredient_id', uniqueIngredientIds);
        if (ingredientClaimsError) throw ingredientClaimsError;
        if (ingredientLevelClaims) allClaimsForBrand.push(...ingredientLevelClaims as DbClaim[]);
      }
    }
  }
  
  console.log(`[claims-utils] Found ${allClaimsForBrand.length} total raw claims for brand ${brandId}.`);
  return allClaimsForBrand;
}

// Placeholder for all mock data - this would eventually come from a proper mock DB or service
const MOCK_PRODUCTS: Product[] = [
  { id: 'prod_1_brand_A', name: 'Product Alpha (Brand A)', brand_id: 'brand_A_acme' },
  { id: 'prod_2_brand_A', name: 'Product Beta (Brand A)', brand_id: 'brand_A_acme' },
  { id: 'prod_3_brand_B', name: 'Product Gamma (Brand B)', brand_id: 'brand_B_globex' },
];

const MOCK_INGREDIENTS: Ingredient[] = [
  { id: 'ingr_1_vanilla', name: 'Vanilla Extract' },
  { id: 'ingr_2_milk', name: 'Whole Milk' },
  { id: 'ingr_3_cocoa', name: 'Cocoa Powder' },
];

const MOCK_PRODUCT_INGREDIENTS: ProductIngredient[] = [
  { product_id: 'prod_1_brand_A', ingredient_id: 'ingr_1_vanilla' },
  { product_id: 'prod_1_brand_A', ingredient_id: 'ingr_2_milk' },
  { product_id: 'prod_2_brand_A', ingredient_id: 'ingr_3_cocoa' },
  { product_id: 'prod_3_brand_B', ingredient_id: 'ingr_1_vanilla' },
  { product_id: 'prod_3_brand_B', ingredient_id: 'ingr_3_cocoa' },
];

const MOCK_CLAIMS_DB: DbClaim[] = [
  // Brand A Claims
  { id: 'bA_claim_1', global_brand_id: 'brand_A_acme', product_id: null, ingredient_id: null, level: 'brand', claim_text: 'Brand A Global: Trusted Quality', claim_type: 'allowed', country_code: CLAIM_COUNTRY_GLOBAL, description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' },
  { id: 'bA_claim_2', global_brand_id: 'brand_A_acme', product_id: null, ingredient_id: null, level: 'brand', claim_text: 'Brand A US: Americas Favorite', claim_type: 'allowed', country_code: 'US', description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' },
  { id: 'bA_claim_3', global_brand_id: 'brand_A_acme', product_id: null, ingredient_id: null, level: 'brand', claim_text: 'Brand A Global: Not for children', claim_type: 'disallowed', country_code: CLAIM_COUNTRY_GLOBAL, description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' },
  // Brand B Claims
  { id: 'bB_claim_1', global_brand_id: 'brand_B_globex', product_id: null, ingredient_id: null, level: 'brand', claim_text: 'Brand B Global: Innovative Solutions', claim_type: 'allowed', country_code: CLAIM_COUNTRY_GLOBAL, description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' },
  
  // Product Claims (prod_1_brand_A)
  { id: 'p1A_claim_1', product_id: 'prod_1_brand_A', global_brand_id: null, ingredient_id: null, level: 'product', claim_text: 'Product Alpha Global: Extra Smooth', claim_type: 'allowed', country_code: CLAIM_COUNTRY_GLOBAL, description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' },
  { id: 'p1A_claim_2', product_id: 'prod_1_brand_A', global_brand_id: null, ingredient_id: null, level: 'product', claim_text: 'Product Alpha US: Now Creamier!', claim_type: 'allowed', country_code: 'US', description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' },
  // Product Claims (prod_2_brand_A)
  { id: 'p2A_claim_1', product_id: 'prod_2_brand_A', global_brand_id: null, ingredient_id: null, level: 'product', claim_text: 'Product Beta Global: Rich Flavor', claim_type: 'allowed', country_code: CLAIM_COUNTRY_GLOBAL, description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' },
  // Product Claims (prod_3_brand_B)
  { id: 'p3B_claim_1', product_id: 'prod_3_brand_B', global_brand_id: null, ingredient_id: null, level: 'product', claim_text: 'Product Gamma Global: High Tech Formula', claim_type: 'mandatory', country_code: CLAIM_COUNTRY_GLOBAL, description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' },
  
  // Ingredient Claims (Vanilla - ingr_1_vanilla)
  { id: 'i_vanilla_1', ingredient_id: 'ingr_1_vanilla', global_brand_id: null, product_id: null, level: 'ingredient', claim_text: 'Vanilla Global: Natural Essence', claim_type: 'allowed', country_code: CLAIM_COUNTRY_GLOBAL, description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' },
  { id: 'i_vanilla_2', ingredient_id: 'ingr_1_vanilla', global_brand_id: null, product_id: null, level: 'ingredient', claim_text: 'Vanilla US: Real Madagascar Vanilla', claim_type: 'allowed', country_code: 'US', description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' },
  // Ingredient Claims (Milk - ingr_2_milk)
  { id: 'i_milk_1', ingredient_id: 'ingr_2_milk', global_brand_id: null, product_id: null, level: 'ingredient', claim_text: 'Milk Global: Contains Dairy', claim_type: 'mandatory', country_code: CLAIM_COUNTRY_GLOBAL, description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' },
  // Ingredient Claims (Cocoa - ingr_3_cocoa)
  { id: 'i_cocoa_1', ingredient_id: 'ingr_3_cocoa', global_brand_id: null, product_id: null, level: 'ingredient', claim_text: 'Cocoa Global: Rich Dark Chocolate Taste', claim_type: 'allowed', country_code: CLAIM_COUNTRY_GLOBAL, description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' },
  { id: 'i_cocoa_2', ingredient_id: 'ingr_3_cocoa', global_brand_id: null, product_id: null, level: 'ingredient', claim_text: 'Cocoa Global: May contain nuts', claim_type: 'disallowed', country_code: CLAIM_COUNTRY_GLOBAL, description: null, created_by: 'mock_user_id', created_at: '2024-04-01T12:00:00', updated_at: '2024-04-01T12:00:00' }, 
];

// Example of how this might be called by the API route in Phase 4:
// app/api/claims/preview/route.ts
// ...
// import { getStackedClaimsForProduct } from '@/lib/claims-utils';
// ...
// export const GET = withAuth(async (req: NextRequest, user) => {
//   ...
//   const stackedClaims = await getStackedClaimsForProduct(productId, countryCode /*, user */);
//   return NextResponse.json({ success: true, data: stackedClaims });
// }); 