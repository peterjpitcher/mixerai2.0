import { NextResponse, NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { withAuth } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-utils';
import { User } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// GET /api/global-claim-brands - List all global claim brands
export const GET = withAuth(async (request: NextRequest, user: User) => {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('global_claim_brands')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch global claim brands');
  }
});

// POST /api/global-claim-brands - Create a new global claim brand
export const POST = withAuth(async (request: NextRequest, user: User) => {
  if (user?.user_metadata?.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: You do not have permission to create global claim brands.' },
      { status: 403 }
    );
  }

  try {
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
      .insert([{ name: name.trim() }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { success: false, error: 'A global claim brand with this name already exists.' },
          { status: 409 } // Conflict
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create global claim brand');
  }
}); 