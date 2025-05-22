import { NextResponse, NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-utils';
import { createSupabaseAdminClient } from '@/lib/supabase/client';

export const dynamic = "force-dynamic";

// POST: Create a new ingredient
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Ingredient name is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: newIngredient, error } = await supabase
      .from('ingredients')
      .insert({
        name,
        description,
        // created_by: user.id, // Assuming ingredients don't have a created_by field as per schema
      })
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
    if (!newIngredient) throw new Error('Failed to create ingredient, no data returned.');

    return NextResponse.json({ success: true, data: newIngredient }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create ingredient');
  }
});

// GET: List ingredients
export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const supabase = createSupabaseAdminClient();
    // TODO: Implement pagination if list becomes very long

    const { data: ingredients, error } = await supabase
      .from('ingredients')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: ingredients || [] });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch ingredients');
  }
}); 