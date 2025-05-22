// Remove the invalid triple quotes at the beginning of the file
// """
// API Route for AI-powered analysis of a stack of claims.
// """
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-utils';
import { generateTextCompletion } from '@/lib/azure/openai';
import { StackedClaim } from '@/lib/claims-utils'; // Assuming StackedClaim is exported from here

export const dynamic = "force-dynamic";

async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ success: false, error: 'Method Not Allowed' }, { status: 405 });
  }

  try {
    const { claims } = await req.json() as { claims: StackedClaim[] };

    if (!Array.isArray(claims) || claims.length === 0) {
      return NextResponse.json({ success: false, error: 'No claims provided for analysis' }, { status: 400 });
    }

    // Construct the prompt for the AI
    // Serialize claims clearly for the AI
    const claimsText = claims.map((claim, index) => 
      `Claim ${index + 1}:
      Text: "${claim.claim_text}"
      Type: ${claim.claim_type}
      Level: ${claim.level}
      Origin: ${claim.origin_level}
      ${claim.level === 'ingredient' && claim.source_entity_id ? `Source Entity (Ingredient ID): ${claim.source_entity_id}` : ''}
      Country: ${claim.country_code === '__GLOBAL__' ? 'Global' : claim.country_code}`
    ).join('\n\n');

    const systemPrompt = `You are an expert marketing compliance analyst. Your task is to review a provided list of marketing claims that apply to a specific product in a specific country context. These claims are "stacked," meaning they come from brand, product, and ingredient levels.
    Analyze the claims for potential issues. Focus on:
    1.  **Contradictions**: Identify any direct contradictions (e.g., one claim says "X is allowed" and another says "X is disallowed", or similar conflicting statements).
    2.  **Ambiguities**: Point out claims that are vague, unclear, or could be misinterpreted.
    3.  **Redundancies**: Note if multiple claims state the same thing in slightly different ways, where simplification might be possible.
    4.  **Compliance Risks**: Based on the claim text and type (allowed, disallowed, mandatory), highlight any potential compliance risks or statements that might be problematic.
    5.  **Overall Cohesion**: Comment on how well the claims work together. Are they consistent and clear as a set?
    
    Provide your analysis as a concise, actionable summary. Use bullet points for specific findings. Be specific in your feedback, referencing claim details if necessary. Do not make up information not present in the claims.
    The claims are for a product in a specific country context, so consider if any claims might be problematic for a "Global" context if they are marked as such.
    If a claim is of type 'disallowed', ensure no other 'allowed' claims directly contradict its intent.
    If a claim is 'mandatory', ensure its presence is logical and it doesn't conflict with 'disallowed' claims.`;

    const userPrompt = `Here is the stack of claims to analyze:
    Product: [Product Name - not provided, analyze based on claims text]
    Country Context: [Country - not provided, analyze based on claims country codes and __GLOBAL__]

    Claims Stack:
    ${claimsText}

    Please provide your analysis:`;
    
    const analysis = await generateTextCompletion(systemPrompt, userPrompt, 1000, 0.7);

    if (!analysis) {
      return NextResponse.json({ success: false, error: 'AI analysis failed to generate a response.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, analysis });

  } catch (error) {
    return handleApiError(error, 'Failed to analyze claims stack');
  }
}

export const POST = withAuth(handler); 