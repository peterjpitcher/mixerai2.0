import { NextResponse, NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-utils';
import { CLAIM_COUNTRY_GLOBAL } from '@/lib/constants'; // To be used for default country_code
import { createSupabaseAdminClient } from '@/lib/supabase/client';

// Define ClaimLevel and ClaimType based on the database schema
export type ClaimType = 'allowed' | 'disallowed' | 'mandatory';
export type ClaimLevel = 'brand' | 'product' | 'ingredient';

export const dynamic = "force-dynamic";

// POST: Create a new claim
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    console.log("--- RAW REQUEST BODY for /api/claims POST ---");
    console.log(JSON.stringify(body, null, 2));

    const {
      claim_text,
      claim_type,
      level,
      global_brand_id,
      product_id,
      ingredient_id,
      country_code,
      description,
    } = body as {
      claim_text: string;
      claim_type: ClaimType;
      level: ClaimLevel;
      global_brand_id?: string;
      product_id?: string;
      ingredient_id?: string;
      country_code?: string;
      description?: string;
    };

    // Basic validation
    if (!claim_text || !claim_type || !level) {
      return NextResponse.json(
        { success: false, error: 'Claim text, type, and level are required' },
        { status: 400 }
      );
    }
    // Additional validation for enum values if needed, though DB will enforce
    const validClaimTypes: ClaimType[] = ['allowed', 'disallowed', 'mandatory'];
    const validClaimLevels: ClaimLevel[] = ['brand', 'product', 'ingredient'];
    if (!validClaimTypes.includes(claim_type)) {
        return NextResponse.json({ success: false, error: `Invalid claim_type. Must be one of: ${validClaimTypes.join(', ')}` }, { status: 400 });
    }
    if (!validClaimLevels.includes(level)) {
        return NextResponse.json({ success: false, error: `Invalid level. Must be one of: ${validClaimLevels.join(', ')}` }, { status: 400 });
    }

    // Level-specific ID validation
    if (level === 'brand' && !global_brand_id) {
      return NextResponse.json({ success: false, error: 'global_brand_id is required for brand-level claims' }, { status: 400 });
    }
    if (level === 'product' && !product_id) {
      return NextResponse.json({ success: false, error: 'product_id is required for product-level claims' }, { status: 400 });
    }
    if (level === 'ingredient' && !ingredient_id) {
      return NextResponse.json({ success: false, error: 'ingredient_id is required for ingredient-level claims' }, { status: 400 });
    }
    
    const finalCountryCode = country_code || CLAIM_COUNTRY_GLOBAL;

    const supabase = createSupabaseAdminClient();

    const insertData = {
      claim_text,
      description,
      claim_type,
      level,
      global_brand_id: level === 'brand' ? global_brand_id : null,
      product_id: level === 'product' ? product_id : null,
      ingredient_id: level === 'ingredient' ? ingredient_id : null,
      country_code: finalCountryCode,
      created_by: user.id,
    };
    console.log("--- INSERT DATA for claims table ---");
    console.log(JSON.stringify(insertData, null, 2));

    const { data: newClaim, error } = await supabase
      .from('claims')
      .insert(insertData)
      .select()
      .single();

    if (error) {
        // Handle unique constraint violation (e.g., uq_claims_definition)
        if (error.code === '23505') {
             return NextResponse.json(
                { success: false, error: 'A similar claim (text, type, level, entity, country) already exists.' },
                { status: 409 } // Conflict
            );
        }
        throw error;
    }
    if (!newClaim) throw new Error('Failed to create claim, no data returned.');

    return NextResponse.json({ success: true, data: newClaim }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create claim');
  }
});

// GET: List claims (filterable)
export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const supabase = createSupabaseAdminClient();

    let query = supabase.from('claims').select(`
      *,
      global_claim_brands (name),
      products (
        name,
        global_brand_id,
        global_claim_brands (name)
      ),
      ingredients (name)
    `);

    // Apply filters
    const levelFilter = searchParams.get('level');
    if (levelFilter) query = query.eq('level', levelFilter as ClaimLevel);

    const brandIdFilter = searchParams.get('brand_id');
    if (brandIdFilter && levelFilter === 'brand') query = query.eq('global_brand_id', brandIdFilter);

    const productIdFilter = searchParams.get('product_id');
    if (productIdFilter) query = query.eq('product_id', productIdFilter);

    const ingredientIdFilter = searchParams.get('ingredient_id');
    if (ingredientIdFilter) query = query.eq('ingredient_id', ingredientIdFilter);

    const countryCodeFilter = searchParams.get('country_code');
    if (countryCodeFilter) query = query.eq('country_code', countryCodeFilter);

    const claimTypeFilter = searchParams.get('claim_type');
    if (claimTypeFilter) query = query.eq('claim_type', claimTypeFilter as ClaimType);

    const claimTextFilter = searchParams.get('claim_text');
    if (claimTextFilter) query = query.ilike('claim_text', `%${claimTextFilter}%`);
    
    const { data: claims, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Format data for easier consumption by UI, especially for product's brand name
    const formattedClaims = claims?.map(claim => {
      let entityName = '';
      let entityBrandName = ''; // This will now hold the global_claim_brand name for product-level claims
      if (claim.level === 'brand' && claim.global_claim_brands) {
        entityName = claim.global_claim_brands.name;
      } else if (claim.level === 'product' && claim.products) {
        entityName = claim.products.name;
        // products.global_claim_brands should be an object { name: string } or null
        if (claim.products.global_claim_brands) {
            entityBrandName = claim.products.global_claim_brands.name;
        }
      } else if (claim.level === 'ingredient' && claim.ingredients) {
        entityName = claim.ingredients.name;
      }
      return {
        ...claim,
        entity_name: entityName,
        entity_brand_name: entityBrandName,
      };
    }) || [];

    return NextResponse.json({ success: true, data: formattedClaims });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch claims');
  }
}); 