import { NextResponse, NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { withAuth } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-utils';
import { User } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// GET /api/global-claim-brands/[id] - Get a single global claim brand by ID
export const GET = withAuth(async (request: NextRequest, user: User, { params }: RouteParams) => {
  try {
    const { id } = params;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('global_claim_brands')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // PostgREST error for "Not found"
        return NextResponse.json({ success: false, error: 'Global claim brand not found.' }, { status: 404 });
      }
      throw error;
    }
    if (!data) {
        return NextResponse.json({ success: false, error: 'Global claim brand not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch global claim brand');
  }
});

// PUT /api/global-claim-brands/[id] - Update a global claim brand by ID
export const PUT = withAuth(async (request: NextRequest, user: User, { params }: RouteParams) => {
  if (user?.user_metadata?.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: You do not have permission to update global claim brands.' },
      { status: 403 }
    );
  }

  try {
    const { id } = params;
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Name is required and must be a non-empty string.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('global_claim_brands')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        return NextResponse.json({ success: false, error: 'Global claim brand not found.' }, { status: 404 });
      }
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { success: false, error: 'A global claim brand with this name already exists.' },
          { status: 409 } // Conflict
        );
      }
      throw error;
    }
    if (!data) { // Should be caught by PGRST116, but as a safeguard
        return NextResponse.json({ success: false, error: 'Global claim brand not found after update attempt.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'Failed to update global claim brand');
  }
});

// DELETE /api/global-claim-brands/[id] - Delete a global claim brand by ID
export const DELETE = withAuth(async (request: NextRequest, user: User, { params }: RouteParams) => {
  if (user?.user_metadata?.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: You do not have permission to delete global claim brands.' },
      { status: 403 }
    );
  }

  try {
    const { id } = params;
    const supabase = createSupabaseAdminClient();

    const { error, count } = await supabase
      .from('global_claim_brands')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) throw error;
    
    if (count === 0) {
        return NextResponse.json({ success: false, error: 'Global claim brand not found.'}, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Global claim brand deleted successfully.' });
  } catch (error) {
    // Check for foreign key constraint violation if a claim still references this global_brand_id
    // supabase-js error might have code '23503' (foreign_key_violation)
    // However, ON DELETE SET NULL should prevent this unless there's another constraint.
    // For now, generic error handling is fine, specific FK error can be added if observed.
    return handleApiError(error, 'Failed to delete global claim brand');
  }
}); 