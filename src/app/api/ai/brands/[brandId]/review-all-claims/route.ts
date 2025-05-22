import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-utils';
import { generateTextCompletion } from '@/lib/azure/openai';
import { getAllClaimsForBrand } from '@/lib/claims-utils'; // Using the new mock util
import { DbClaim } from '@/lib/claims-utils'; // Assuming DbClaim is exported

export const dynamic = "force-dynamic";

interface RouteParams {
  brandId: string;
}

async function handler(req: NextRequest, user: any, { params }: { params: RouteParams }) {
  const { brandId } = params;
  if (req.method !== 'GET') {
    return NextResponse.json({ success: false, error: 'Method Not Allowed' }, { status: 405 });
  }

  if (!brandId) {
    return NextResponse.json({ success: false, error: 'Brand ID is required' }, { status: 400 });
  }

  try {
    const allBrandClaims: DbClaim[] = await getAllClaimsForBrand(brandId);

    if (!Array.isArray(allBrandClaims) || allBrandClaims.length === 0) {
      return NextResponse.json({ success: false, error: `No claims found for brand ${brandId} to analyze` }, { status: 404 });
    }

    const claimsText = allBrandClaims.map((claim, index) => 
      `Claim ${index + 1}:
      Text: "${claim.claim_text}"
      Type: ${claim.claim_type}
      Level: ${claim.level}
      ${claim.product_id ? `Associated Product ID: ${claim.product_id}` : ''}
      ${claim.ingredient_id ? `Associated Ingredient ID: ${claim.ingredient_id}` : ''}
      Country: ${claim.country_code === '__GLOBAL__' ? 'Global' : claim.country_code}`
    ).join('\n\n');

    const systemPrompt = `You are an expert marketing compliance consultant. Your task is to perform a HOLISTIC review of ALL marketing claims associated with an entire brand. This includes brand-level claims, claims for all products under this brand, and claims related to all ingredients used in those products.
    Analyze this comprehensive list for:
    1.  **Brand Consistency**: Do product and ingredient claims align with the overall brand messaging and brand-level claims? Are there contradictions or misalignments?
    2.  **Cross-Product Consistency**: If multiple products share ingredients or similar features, are the claims about them consistent? 
    3.  **Global vs. Country-Specific Conflicts**: Identify if any global claims are inappropriately overridden or contradicted by country-specific claims, or vice-versa, leading to brand image fragmentation.
    4.  **Over-Messaging/Claim Fatigue**: Is the brand making too many similar claims across different levels, potentially confusing consumers?
    5.  **Gaps in Messaging**: Are there any obvious gaps where a key product feature or brand attribute is not supported by a claim?
    6.  **Overall Portfolio Risk**: Assess the overall risk profile from a claims perspective. Are there patterns of high-risk claims?
    7.  **Opportunities for Simplification/Harmonization**: Suggest ways to streamline or harmonize claims across the brand portfolio for clarity and impact.

    Provide your analysis as a comprehensive, actionable report. Use clear headings and bullet points. Be specific and reference claim details where necessary. Focus on the bigger picture and inter-dependencies between claims.`;

    const userPrompt = `Here is the complete list of claims for brand ID "${brandId}" to analyze:

    ${claimsText}

    Please provide your holistic brand claims review:`;
    
    const analysis = await generateTextCompletion(systemPrompt, userPrompt, 2000, 0.7); // Increased maxTokens for more comprehensive review

    if (!analysis) {
      return NextResponse.json({ success: false, error: 'AI analysis failed to generate a response for the brand review.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, analysis });

  } catch (error) {
    return handleApiError(error, `Failed to perform holistic claims review for brand ${brandId}`);
  }
}

export const GET = withAuth(handler); 