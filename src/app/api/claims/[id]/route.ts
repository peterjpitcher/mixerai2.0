import { NextResponse, NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-utils';
import { CLAIM_COUNTRY_GLOBAL } from '@/lib/constants';
import { createSupabaseAdminClient } from '@/lib/supabase/client';

// Define ClaimLevel and ClaimType based on the database schema (duplicated from ./route.ts to avoid circular dependency)
export type ClaimType = 'allowed' | 'disallowed' | 'mandatory';
export type ClaimLevel = 'brand' | 'product' | 'ingredient';

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

// GET: Get a single claim by ID
export const GET = withAuth(async (req: NextRequest, user, { params }: RouteParams) => {
  try {
    const { id } = params;
    const supabase = createSupabaseAdminClient();

    const { data: claim, error } = await supabase
      .from('claims')
      .select(`
        *,
        global_claim_brands (name),
        products (name, global_brand_id, global_claim_brands (name)),
        ingredients (name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!claim) return NextResponse.json({ success: false, error: 'Claim not found' }, { status: 404 });

    // Format data for easier consumption
    let entityName = '';
    let entityBrandName = '';
    if (claim.level === 'brand' && claim.global_claim_brands) {
      entityName = claim.global_claim_brands.name;
      entityBrandName = claim.global_claim_brands.name;
    } else if (claim.level === 'product' && claim.products) {
      entityName = claim.products.name;
      if (claim.products.global_claim_brands) {
        entityBrandName = claim.products.global_claim_brands.name;
      }
    } else if (claim.level === 'ingredient' && claim.ingredients) {
      entityName = claim.ingredients.name;
    }

    const formattedClaim = {
      ...claim,
      entity_name: entityName,
      entity_brand_name: entityBrandName,
    };

    return NextResponse.json({ success: true, data: formattedClaim });
  } catch (error) {
    return handleApiError(error, `Failed to fetch claim ${params.id}`);
  }
});

// PUT: Update a claim
export const PUT = withAuth(async (req: NextRequest, user, { params }: RouteParams) => {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      claim_text,
      claim_type,
      country_code,
      description,
      // level, brand_id, product_id, ingredient_id are not updatable here
      // to maintain the integrity of the claim's core association.
      // If these need to change, it's better to delete and recreate.
    } = body as {
      claim_text?: string;
      claim_type?: ClaimType;
      country_code?: string;
      description?: string;
    };
    const supabase = createSupabaseAdminClient();

    const updateData: { 
        claim_text?: string; 
        claim_type?: ClaimType; 
        country_code?: string; 
        description?: string; 
        updated_at: string; 
    } = { updated_at: new Date().toISOString() };

    if (claim_text) updateData.claim_text = claim_text;
    if (claim_type) {
        const validClaimTypes: ClaimType[] = ['allowed', 'disallowed', 'mandatory'];
        if (!validClaimTypes.includes(claim_type)) {
            return NextResponse.json({ success: false, error: `Invalid claim_type. Must be one of: ${validClaimTypes.join(', ')}` }, { status: 400 });
        }
        updateData.claim_type = claim_type;
    }
    if (country_code) updateData.country_code = country_code; // Can be CLAIM_COUNTRY_GLOBAL
    if (description) updateData.description = description;

    if (Object.keys(updateData).length === 1 && 'updated_at' in updateData) {
        return NextResponse.json({ success: false, error: 'No fields provided to update.' }, { status: 400 });
    }

    const { data: updatedClaim, error } = await supabase
      .from('claims')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
        // Handle unique constraint violation (e.g., uq_claims_definition)
        // This might occur if the update makes it identical to another existing claim.
        if (error.code === '23505') {
             return NextResponse.json(
                { success: false, error: 'Updating this claim would make it identical to an existing claim.' },
                { status: 409 } // Conflict
            );
        }
        throw error;
    }
    if (!updatedClaim) throw new Error('Failed to update claim, no data returned or claim not found.');

    return NextResponse.json({ success: true, data: updatedClaim });
  } catch (error) {
    return handleApiError(error, `Failed to update claim ${params.id}`);
  }
});

// DELETE: Delete a claim
export const DELETE = withAuth(async (req: NextRequest, user, { params }: RouteParams) => {
  try {
    const { id } = params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('claims')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // We can check `count` from the response if needed, but if no error, assume success.
    // const { count, error } = await supabase.from('claims').delete().eq('id', id);
    // if (count === 0) return NextResponse.json({ success: false, error: 'Claim not found or not deleted' }, { status: 404 });

    return NextResponse.json({ success: true, message: `Claim ${id} deleted successfully` });
  } catch (error) {
    return handleApiError(error, `Failed to delete claim ${params.id}`);
  }
}); 