import { NextResponse, NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { handleApiError, isBuildPhase } from '@/lib/api-utils';
import { withAuth } from '@/lib/auth/api-auth';
import { User } from '@supabase/supabase-js';

export const dynamic = "force-dynamic";

interface Product {
    id: string;
    name: string;
    description: string | null;
    master_brand_id: string; // Renamed from global_brand_id, FK, should be required
    created_at?: string;
    updated_at?: string;
}

// GET handler for all products
export const GET = withAuth(async (req: NextRequest, user: User) => {
    // TODO: Implement filtering by master_brand_id if needed as a query param
    // TODO: Implement permission checks - user might only see products for brands they have access to.
    try {
        if (isBuildPhase()) {
            console.log('[API Products GET] Build phase: returning empty array.');
            return NextResponse.json({ success: true, isMockData: true, data: [] });
        }

        const supabase = createSupabaseAdminClient();
        // @ts-ignore
        const { data, error } = await supabase.from('products')
            .select('*') // Consider selecting specific fields or related data like brand name
            .order('name');

        if (error) {
            console.error('[API Products GET] Error fetching products:', error);
            return handleApiError(error, 'Failed to fetch products');
        }
        
        const validatedData = Array.isArray(data) ? data.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            master_brand_id: item.master_brand_id, // Renamed
            created_at: item.created_at,
            updated_at: item.updated_at
        })) : [];

        return NextResponse.json({ success: true, data: validatedData as Product[] });

    } catch (error: any) {
        console.error('[API Products GET] Catched error:', error);
        return handleApiError(error, 'An unexpected error occurred while fetching products.');
    }
});

// POST handler for creating a new product
export const POST = withAuth(async (req: NextRequest, user: User) => {
    try {
        const body = await req.json();
        const { name, description, master_brand_id } = body; // Renamed global_brand_id

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return NextResponse.json(
                { success: false, error: 'Product name is required and must be a non-empty string.' },
                { status: 400 }
            );
        }
        if (!master_brand_id || typeof master_brand_id !== 'string') { // Renamed
            return NextResponse.json(
                { success: false, error: 'Master Brand ID is required.' }, // Renamed
                { status: 400 }
            );
        }
        if (description && typeof description !== 'string') {
            return NextResponse.json(
               { success: false, error: 'Description must be a string if provided.' },
               { status: 400 }
           );
       }

        const supabase = createSupabaseAdminClient();
        
        // --- Permission Check Start ---
        let hasPermission = user?.user_metadata?.role === 'admin';

        if (!hasPermission && master_brand_id) { // Renamed
            // @ts-ignore
            const { data: mcbData, error: mcbError } = await supabase // Renamed gcbData to mcbData
                .from('master_claim_brands') // Renamed table
                .select('mixerai_brand_id')
                .eq('id', master_brand_id) // Renamed
                .single();

            if (mcbError || !mcbData || !mcbData.mixerai_brand_id) {
                console.error(`[API Products POST] Error fetching MCB or MCB not linked for permissions (MCB ID: ${master_brand_id}):`, mcbError);
                // Deny if MCB not found or not linked to a core MixerAI brand
            } else {
                // @ts-ignore
                const { data: permissionsData, error: permissionsError } = await supabase
                    .from('user_brand_permissions')
                    .select('role')
                    .eq('user_id', user.id)
                    .eq('brand_id', mcbData.mixerai_brand_id)
                    .eq('role', 'admin') // Must be an admin of the core MixerAI brand
                    .limit(1);

                if (permissionsError) {
                    console.error(`[API Products POST] Error fetching user_brand_permissions:`, permissionsError);
                } else if (permissionsData && permissionsData.length > 0) {
                    hasPermission = true;
                }
            }
        } else if (!master_brand_id && !hasPermission) { // Renamed
             // This case should ideally be caught by required field validation for master_brand_id earlier.
             // If master_brand_id is missing and user is not admin, deny.
        }

        if (!hasPermission) {
            return NextResponse.json(
                { success: false, error: 'You do not have permission to create a product for this brand.' },
                { status: 403 }
            );
        }
        // --- Permission Check End ---
        
        const newRecord: Omit<Product, 'id' | 'created_at' | 'updated_at'> = {
            name: name.trim(),
            description: description?.trim() || null,
            master_brand_id: master_brand_id // Renamed
        };

        // @ts-ignore
        const { data, error } = await supabase.from('products')
            .insert(newRecord)
            .select()
            .single();

        if (error) {
            console.error('[API Products POST] Error creating product:', error);
            if ((error as any).code === '23505') { // Unique violation for (master_brand_id, name)
                 return NextResponse.json(
                    { success: false, error: 'A product with this name already exists for this brand.' },
                    { status: 409 } // Conflict
                );
            }
            if ((error as any).code === '23503') { // Foreign key violation for master_brand_id
                return NextResponse.json(
                   { success: false, error: 'Invalid Master Brand ID. The specified brand does not exist.' }, // Renamed
                   { status: 400 } // Bad request
               );
           }
            return handleApiError(error, 'Failed to create product.');
        }

        const singleDataObject = data as any;
        const validatedData: Product = {
            id: singleDataObject.id,
            name: singleDataObject.name,
            description: singleDataObject.description,
            master_brand_id: singleDataObject.master_brand_id, // Renamed
            created_at: singleDataObject.created_at,
            updated_at: singleDataObject.updated_at
        };

        return NextResponse.json({ success: true, data: validatedData }, { status: 201 });

    } catch (error: any) {
        console.error('[API Products POST] Catched error:', error);
        if (error.name === 'SyntaxError') { // JSON parsing error
            return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
        }
        return handleApiError(error, 'An unexpected error occurred while creating the product.');
    }
}); 