import { NextResponse, NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-utils';
import { CLAIM_COUNTRY_GLOBAL } from '@/lib/constants';
// import { createSupabaseAdminClient } from '@/lib/supabase/client'; // Not needed directly here, claims-utils handles it
import { getStackedClaimsForProduct } from '@/lib/claims-utils';

export const dynamic = "force-dynamic";

// GET: Get stacked claims for a product and country
export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const countryCode = searchParams.get('countryCode') || CLAIM_COUNTRY_GLOBAL;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      );
    }

    const stackedClaims = await getStackedClaimsForProduct(productId, countryCode);
    
    return NextResponse.json({ success: true, data: stackedClaims });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch stacked claims');
  }
}); 