import { NextResponse, NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { handleApiError } from '@/lib/api-utils';
import { withAuth } from '@/lib/auth/api-auth';
import { User } from '@supabase/supabase-js';

export const dynamic = "force-dynamic";

// ENUM types mirroring the database
type ClaimTypeEnum = 'allowed' | 'disallowed' | 'mandatory';
type ClaimLevelEnum = 'brand' | 'product' | 'ingredient';

interface Claim {
    id: string;
    claim_text: string;
    claim_type: ClaimTypeEnum;
    level: ClaimLevelEnum;
    master_brand_id?: string | null;
    product_id?: string | null;
    ingredient_id?: string | null;
    country_code: string;
    description?: string | null;
    created_by?: string | null;
    created_at?: string;
    updated_at?: string;
}

interface RequestContext {
    params: {
        id: string; // Claim ID
    };
}

// GET handler for a single claim by ID
export const GET = withAuth(async (req: NextRequest, user: User, context: RequestContext) => {
    const { id } = context.params;
    if (!id) {
        return NextResponse.json({ success: false, error: 'Claim ID is required.' }, { status: 400 });
    }
    // TODO: Implement permission checks

    try {
        const supabase = createSupabaseAdminClient();
        // @ts-ignore
        const { data, error } = await supabase.from('claims')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error(`[API Claims GET /${id}] Error fetching claim:`, error);
            if (error.code === 'PGRST116') { 
                return NextResponse.json({ success: false, error: 'Claim not found.' }, { status: 404 });
            }
            return handleApiError(error, 'Failed to fetch claim.');
        }

        if (!data) {
            return NextResponse.json({ success: false, error: 'Claim not found.' }, { status: 404 });
        }
        
        const singleDataObject = data as any;
        const validatedData: Claim = {
            id: singleDataObject.id,
            claim_text: singleDataObject.claim_text,
            claim_type: singleDataObject.claim_type,
            level: singleDataObject.level,
            master_brand_id: singleDataObject.master_brand_id,
            product_id: singleDataObject.product_id,
            ingredient_id: singleDataObject.ingredient_id,
            country_code: singleDataObject.country_code,
            description: singleDataObject.description,
            created_by: singleDataObject.created_by,
            created_at: singleDataObject.created_at,
            updated_at: singleDataObject.updated_at
        };

        return NextResponse.json({ success: true, data: validatedData });

    } catch (error: any) {
        console.error(`[API Claims GET /${id}] Catched error:`, error);
        return handleApiError(error, 'An unexpected error occurred while fetching the claim.');
    }
});

// PUT handler for updating a claim by ID
export const PUT = withAuth(async (req: NextRequest, user: User, context: RequestContext) => {
    const { id } = context.params;
    if (!id) {
        return NextResponse.json({ success: false, error: 'Claim ID is required for update.' }, { status: 400 });
    }

    try {
        const body = await req.json();
        const { claim_text, claim_type, description, country_code } = body;

        // Level and associated entity IDs (product_id, master_brand_id, ingredient_id) are not updatable here.
        // To change those, one would typically delete and recreate the claim if necessary.

        const updatePayload: Partial<Omit<Claim, 'id' | 'level' | 'master_brand_id' | 'product_id' | 'ingredient_id' | 'created_by' | 'created_at'> & { updated_at: string }> = {
            updated_at: new Date().toISOString(),
        };

        if (claim_text !== undefined) {
            if (typeof claim_text !== 'string' || claim_text.trim() === '') {
                return NextResponse.json({ success: false, error: 'Claim text must be a non-empty string.' }, { status: 400 });
            }
            updatePayload.claim_text = claim_text.trim();
        }
        if (claim_type !== undefined) {
            if (!['allowed', 'disallowed', 'mandatory'].includes(claim_type)) {
                return NextResponse.json({ success: false, error: 'Invalid claim_type.' }, { status: 400 });
            }
            updatePayload.claim_type = claim_type;
        }
        if (description !== undefined) { // Allows setting description to null or a new string
            if (description !== null && typeof description !== 'string') {
                 return NextResponse.json({ success: false, error: 'Description must be a string or null.' }, { status: 400 });
            }
            updatePayload.description = description === null ? null : description.trim();
        }
        if (country_code !== undefined) {
            if (typeof country_code !== 'string' || country_code.trim() === '') {
                return NextResponse.json({ success: false, error: 'Country code must be a non-empty string.' }, { status: 400 });
            }
            updatePayload.country_code = country_code.trim();
        }

        if (Object.keys(updatePayload).length === 1 && updatePayload.updated_at) {
            // Only updated_at is present, meaning no actual updatable fields were provided
            return NextResponse.json({ success: false, error: 'No updatable fields provided.' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        // --- Permission Check Start ---
        let hasPermission = user?.user_metadata?.role === 'admin';

        if (!hasPermission) {
            // Fetch the claim to determine its context for permission checking
            // @ts-ignore
            const { data: claimData, error: claimFetchError } = await supabase
                .from('claims')
                .select('level, master_brand_id, product_id, created_by')
                .eq('id', id)
                .single();

            if (claimFetchError || !claimData) {
                console.error(`[API Claims PUT /${id}] Error fetching claim for permissions:`, claimFetchError);
                return handleApiError(claimFetchError || new Error('Claim not found for permission check'), 'Failed to verify claim for permissions.');
            }

            // Allow if user is the creator of the claim
            if (claimData.created_by === user.id) {
                hasPermission = true;
            }

            if (!hasPermission && claimData) { 
                let coreBrandId: string | null = null;
                if (claimData.level === 'brand' && claimData.master_brand_id) { 
                    // @ts-ignore
                    const { data: mcbData, error: mcbError } = await supabase 
                        .from('master_claim_brands') 
                        .select('mixerai_brand_id')
                        .eq('id', claimData.master_brand_id) 
                        .single();
                    if (mcbError || !mcbData) {
                        console.error(`[API Claims PUT /${id}] Error fetching MCB for brand-level claim permissions:`, mcbError);
                    } else {
                        coreBrandId = mcbData.mixerai_brand_id;
                    }
                } else if (claimData.level === 'product' && claimData.product_id) {
                    // @ts-ignore
                    const { data: productData, error: productError } = await supabase
                        .from('products')
                        .select('master_brand_id') 
                        .eq('id', claimData.product_id)
                        .single();
                    if (productError || !productData || !productData.master_brand_id) {
                        console.error(`[API Claims PUT /${id}] Error fetching product/MCB for product-level claim permissions:`, productError);
                    } else {
                        // @ts-ignore
                        const { data: mcbData, error: mcbError } = await supabase 
                            .from('master_claim_brands') 
                            .select('mixerai_brand_id')
                            .eq('id', productData.master_brand_id) 
                            .single();
                        if (mcbError || !mcbData) {
                            console.error(`[API Claims PUT /${id}] Error fetching MCB for product-level claim (via product) permissions:`, mcbError);
                        } else {
                            coreBrandId = mcbData.mixerai_brand_id;
                        }
                    }
                } else if (claimData.level === 'ingredient') {
                    // For ingredient-level claims, only global admin (already checked) or creator can modify for now.
                    // hasPermission would be true if creator, or if already global admin.
                }

                if (coreBrandId) {
                    // @ts-ignore
                    const { data: permissionsData, error: permissionsError } = await supabase
                        .from('user_brand_permissions')
                        .select('role')
                        .eq('user_id', user.id)
                        .eq('brand_id', coreBrandId)
                        .eq('role', 'admin') // Must be a brand admin
                        .limit(1);
                    if (permissionsError) {
                        console.error(`[API Claims PUT /${id}] Error fetching user_brand_permissions:`, permissionsError);
                    } else if (permissionsData && permissionsData.length > 0) {
                        hasPermission = true;
                    }
                }
            }
        }

        if (!hasPermission) {
            return NextResponse.json({ success: false, error: 'You do not have permission to update this claim.' }, { status: 403 });
        }
        // --- Permission Check End ---

        // @ts-ignore
        const { data, error } = await supabase.from('claims')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error(`[API Claims PUT /${id}] Error updating claim:`, error);
            if ((error as any).code === '23505') { // Unique constraint violation
                return NextResponse.json(
                   { success: false, error: 'This update would result in a duplicate claim (text, type, level, entity, country combination).' },
                   { status: 409 }
               );
           }
            // Note: CHECK constraint chk_claim_level_reference is not relevant here as level/FKs are not changed.
            return handleApiError(error, 'Failed to update claim.');
        }

        if (!data) {
            return NextResponse.json({ success: false, error: 'Claim not found or update failed.' }, { status: 404 });
        }

        const singleDataObject = data as any;
        const validatedData: Claim = {
            id: singleDataObject.id,
            claim_text: singleDataObject.claim_text,
            claim_type: singleDataObject.claim_type,
            level: singleDataObject.level,
            master_brand_id: singleDataObject.master_brand_id,
            product_id: singleDataObject.product_id,
            ingredient_id: singleDataObject.ingredient_id,
            country_code: singleDataObject.country_code,
            description: singleDataObject.description,
            created_by: singleDataObject.created_by,
            created_at: singleDataObject.created_at,
            updated_at: singleDataObject.updated_at
        };

        return NextResponse.json({ success: true, data: validatedData });

    } catch (error: any) {
        console.error(`[API Claims PUT /${id}] Catched error:`, error);
        if (error.name === 'SyntaxError') { 
            return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
        }
        return handleApiError(error, 'An unexpected error occurred while updating the claim.');
    }
});

// DELETE handler for a claim by ID
export const DELETE = withAuth(async (req: NextRequest, user: User, context: RequestContext) => {
    const { id } = context.params;
    if (!id) {
        return NextResponse.json({ success: false, error: 'Claim ID is required for deletion.' }, { status: 400 });
    }

    try {
        const supabase = createSupabaseAdminClient();
        
        // --- Permission Check Start ---
        let hasPermission = user?.user_metadata?.role === 'admin';

        if (!hasPermission) {
            // Fetch the claim to determine its context for permission checking
            // @ts-ignore
            const { data: claimData, error: claimFetchError } = await supabase
                .from('claims')
                .select('level, master_brand_id, product_id, created_by')
                .eq('id', id)
                .single();

            if (claimFetchError) { 
                console.error(`[API Claims DELETE /${id}] Error fetching claim for permissions:`, claimFetchError);
                return handleApiError(claimFetchError, 'Failed to verify claim for permissions before deletion.');
            }
            if (!claimData) { // Claim not found, let the actual delete call handle the 404 or specific error.
                // Proceed to delete attempt which will fail if claim not found or if other error occurs
            } else {
                if (claimData.created_by === user.id) {
                    hasPermission = true;
                }

                if (!hasPermission && claimData) { 
                    let coreBrandId: string | null = null;
                    if (claimData.level === 'brand' && claimData.master_brand_id) { 
                        // @ts-ignore
                        const { data: mcbData, error: mcbError } = await supabase 
                            .from('master_claim_brands') 
                            .select('mixerai_brand_id')
                            .eq('id', claimData.master_brand_id) 
                            .single();
                        if (mcbError || !mcbData) {
                            console.error(`[API Claims DELETE /${id}] Error fetching MCB for brand-level claim permissions:`, mcbError);
                        } else {
                            coreBrandId = mcbData.mixerai_brand_id;
                        }
                    } else if (claimData.level === 'product' && claimData.product_id) {
                        // @ts-ignore
                        const { data: productData, error: productError } = await supabase
                            .from('products')
                            .select('master_brand_id') 
                            .eq('id', claimData.product_id)
                            .single();
                        if (productError || !productData || !productData.master_brand_id) {
                            console.error(`[API Claims DELETE /${id}] Error fetching product/MCB for product-level claim permissions:`, productError);
                        } else {
                            // @ts-ignore
                            const { data: mcbData, error: mcbError } = await supabase 
                                .from('master_claim_brands') 
                                .select('mixerai_brand_id')
                                .eq('id', productData.master_brand_id) 
                                .single();
                            if (mcbError || !mcbData) {
                                console.error(`[API Claims DELETE /${id}] Error fetching MCB for product-level claim (via product) permissions:`, mcbError);
                            } else {
                                coreBrandId = mcbData.mixerai_brand_id;
                            }
                        }
                    } 

                    if (coreBrandId) {
                        // @ts-ignore
                        const { data: permissionsData, error: permissionsError } = await supabase
                            .from('user_brand_permissions')
                            .select('role')
                            .eq('user_id', user.id)
                            .eq('brand_id', coreBrandId)
                            .eq('role', 'admin') 
                            .limit(1);
                        if (permissionsError) {
                            console.error(`[API Claims DELETE /${id}] Error fetching user_brand_permissions:`, permissionsError);
                        } else if (permissionsData && permissionsData.length > 0) {
                            hasPermission = true;
                        }
                    }
                }
            }
        }

        if (!hasPermission) {
            return NextResponse.json({ success: false, error: 'You do not have permission to delete this claim.' }, { status: 403 });
        }
        // --- Permission Check End ---

        // @ts-ignore
        const { error, count } = await supabase.from('claims')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) {
            console.error(`[API Claims DELETE /${id}] Error deleting claim:`, error);
            return handleApiError(error, 'Failed to delete claim.');
        }

        if (count === 0) {
            return NextResponse.json({ success: false, error: 'Claim not found.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Claim deleted successfully.' });

    } catch (error: any) {
        console.error(`[API Claims DELETE /${id}] Catched error:`, error);
        return handleApiError(error, 'An unexpected error occurred while deleting the claim.');
    }
}); 