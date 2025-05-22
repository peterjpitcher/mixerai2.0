import { NextResponse, NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-utils';
import { createSupabaseAdminClient } from '@/lib/supabase/client';

export const dynamic = "force-dynamic";

// POST: Create a new product
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { name, description, global_brand_id, ingredient_ids } = body;

    if (!name || !global_brand_id) {
      return NextResponse.json(
        { success: false, error: 'Product name and global_brand_id are required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Create product
    const { data: productData, error: productError } = await supabase
      .from('products')
      .insert({
        name,
        description,
        global_brand_id,
        created_by: user.id,
      })
      .select()
      .single();

    if (productError) throw productError;
    if (!productData) throw new Error('Failed to create product, no data returned.');

    // If ingredient_ids are provided, link them in product_ingredients
    if (ingredient_ids && Array.isArray(ingredient_ids) && ingredient_ids.length > 0) {
      const productIngredients = ingredient_ids.map((ingredient_id: string) => ({
        product_id: productData.id,
        ingredient_id,
      }));

      const { error: productIngredientsError } = await supabase
        .from('product_ingredients')
        .insert(productIngredients);

      if (productIngredientsError) {
        // Rollback or log error more gracefully - for now, just throw
        console.error('Failed to link ingredients to product:', productIngredientsError);
        // Potentially delete the product created if ingredients linking fails critically
        throw new Error(`Product created, but failed to link ingredients: ${productIngredientsError.message}`);
      }
    }

    return NextResponse.json({ success: true, data: productData }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create product');
  }
});

// GET: List products (potentially filterable by global_brand_id)
export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const globalBrandId = searchParams.get('global_brand_id');
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('products')
      .select(`
        *,
        global_claim_brands (name)
      `);

    if (globalBrandId) {
      query = query.eq('global_brand_id', globalBrandId);
    }

    const { data: products, error } = await query.order('name', { ascending: true });

    if (error) throw error;

    const formattedProducts = products.map(p => ({
      ...p,
      brand_name: p.global_claim_brands?.name,
    }));

    return NextResponse.json({ success: true, data: formattedProducts });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch products');
  }
}); 