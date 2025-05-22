import { NextResponse, NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-utils';
import { createSupabaseAdminClient } from '@/lib/supabase/client';

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

// GET: Get a single product by ID
export const GET = withAuth(async (req: NextRequest, user, { params }: RouteParams) => {
  try {
    const { id } = params;
    const supabase = createSupabaseAdminClient();

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        global_claim_brands:global_brand_id (name),
        product_ingredients (
          ingredients (id, name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });

    const formattedProduct = {
        ...product,
        brand_name: product.global_claim_brands?.name,
        ingredients: product.product_ingredients.map((pi: any) => pi.ingredients),
    };

    return NextResponse.json({ success: true, data: formattedProduct });
  } catch (error) {
    return handleApiError(error, `Failed to fetch product ${params.id}`);
  }
});

// PUT: Update a product
export const PUT = withAuth(async (req: NextRequest, user, { params }: RouteParams) => {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, description, brand_id, ingredient_ids } = body;
    const supabase = createSupabaseAdminClient();

    // Update product details
    const { data: updatedProductData, error: updateError } = await supabase
      .from('products')
      .update({
        name,
        description,
        brand_id, // Assuming brand_id can be updated
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    if (!updatedProductData) throw new Error('Failed to update product, no data returned.');

    // Handle ingredient associations
    // 1. Remove existing associations
    const { error: deleteAssociationsError } = await supabase
      .from('product_ingredients')
      .delete()
      .eq('product_id', id);

    if (deleteAssociationsError) {
      console.error('Failed to delete existing ingredient associations:', deleteAssociationsError);
      // Potentially don't throw, or handle more gracefully, as product itself was updated.
      // For now, let it be known that product was updated but associations might be stale.
    }

    // 2. Add new associations if ingredient_ids are provided
    if (ingredient_ids && Array.isArray(ingredient_ids) && ingredient_ids.length > 0) {
      const newProductIngredients = ingredient_ids.map((ingredient_id: string) => ({
        product_id: id,
        ingredient_id,
      }));

      const { error: addAssociationsError } = await supabase
        .from('product_ingredients')
        .insert(newProductIngredients);

      if (addAssociationsError) {
        console.error('Failed to add new ingredient associations:', addAssociationsError);
        throw new Error(`Product updated, but failed to update ingredient associations: ${addAssociationsError.message}`);
      }
    }

    // Refetch the product to return it with updated associations
    const { data: finalProduct, error: refetchError } = await supabase
      .from('products')
      .select(`
        *,
        global_claim_brands:global_brand_id (name),
        product_ingredients (
          ingredients (id, name)
        )
      `)
      .eq('id', id)
      .single();
      
    if (refetchError) throw refetchError;
    if (!finalProduct) return NextResponse.json({ success: false, error: 'Product not found after update' }, { status: 404 });

    const formattedFinalProduct = {
      ...finalProduct,
      brand_name: finalProduct.global_claim_brands?.name,
      ingredients: finalProduct.product_ingredients.map((pi: any) => pi.ingredients),
    };

    return NextResponse.json({ success: true, data: formattedFinalProduct });
  } catch (error) {
    return handleApiError(error, `Failed to update product ${params.id}`);
  }
});

// DELETE: Delete a product
export const DELETE = withAuth(async (req: NextRequest, user, { params }: RouteParams) => {
  try {
    const { id } = params;
    const supabase = createSupabaseAdminClient();

    // Product_ingredients are deleted by cascade constraint in the DB, so no need to manually delete them.
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: `Product ${id} deleted successfully` });
  } catch (error) {
    return handleApiError(error, `Failed to delete product ${params.id}`);
  }
}); 