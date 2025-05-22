import { NextResponse, NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-utils';
import { createSupabaseAdminClient } from '@/lib/supabase/client';

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

// GET: Get a single ingredient by ID
export const GET = withAuth(async (req: NextRequest, user, { params }: RouteParams) => {
  try {
    const { id } = params;
    const supabase = createSupabaseAdminClient();

    const { data: ingredient, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!ingredient) return NextResponse.json({ success: false, error: 'Ingredient not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: ingredient });
  } catch (error) {
    return handleApiError(error, `Failed to fetch ingredient ${params.id}`);
  }
});

// PUT: Update an ingredient
export const PUT = withAuth(async (req: NextRequest, user, { params }: RouteParams) => {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, description } = body;
    const supabase = createSupabaseAdminClient();

    const { data: updatedIngredient, error } = await supabase
      .from('ingredients')
      .update({
        name,
        description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation for ingredient name
        return NextResponse.json(
          { success: false, error: 'An ingredient with this name already exists.' },
          { status: 409 } // Conflict
        );
      }
      throw error;
    }
    if (!updatedIngredient) throw new Error('Failed to update ingredient, no data returned or ingredient not found.');

    return NextResponse.json({ success: true, data: updatedIngredient });
  } catch (error) {
    return handleApiError(error, `Failed to update ingredient ${params.id}`);
  }
});

// DELETE: Delete an ingredient
export const DELETE = withAuth(async (req: NextRequest, user, { params }: RouteParams) => {
  try {
    const { id } = params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id);

    if (error) {
        // Check for foreign key violation (code 23503)
        if (error.code === '23503') {
            return NextResponse.json(
                { success: false, error: 'Cannot delete ingredient: It is currently referenced by one or more products or claims.' },
                { status: 409 } // Conflict
            );
        }
        throw error;
    }

    // Check if any row was actually deleted (rowCount might not be reliable on all PG versions/drivers)
    // A select after delete or checking the error status is more robust.
    // For now, if no error, assume success. A more robust check could be added if needed.

    return NextResponse.json({ success: true, message: `Ingredient ${id} deleted successfully` });
  } catch (error) {
    return handleApiError(error, `Failed to delete ingredient ${params.id}`);
  }
}); 