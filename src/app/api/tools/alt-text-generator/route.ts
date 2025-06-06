import { NextRequest, NextResponse } from 'next/server';
import { generateAltText } from '@/lib/azure/openai';
import { withAuthAndMonitoring } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-utils';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { Database, Json } from '@/types/supabase';

// In-memory rate limiting
const rateLimit = new Map<string, { count: number, timestamp: number }>();
const RATE_LIMIT_PERIOD = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 10; // Allow 10 requests per minute per IP

interface AltTextGenerationRequest {
  imageUrls: string[];
  language?: string; // Add language field from request
}

interface AltTextResultItem {
  imageUrl: string;
  altText?: string;
  error?: string;
}

const tldToLangCountry: { [key: string]: { language: string; country: string } } = {
  '.fr': { language: 'fr', country: 'FR' },
  '.de': { language: 'de', country: 'DE' },
  '.es': { language: 'es', country: 'ES' },
  '.it': { language: 'it', country: 'IT' },
  '.co.uk': { language: 'en', country: 'GB' },
  '.com.au': { language: 'en', country: 'AU' },
  '.ca': { language: 'en', country: 'CA' }, // Could also be 'fr'
  '.jp': { language: 'ja', country: 'JP' },
  '.cn': { language: 'zh', country: 'CN' },
  '.nl': { language: 'nl', country: 'NL' },
  '.br': { language: 'pt', country: 'BR' },
  '.ru': { language: 'ru', country: 'RU' },
  '.in': { language: 'en', country: 'IN' },
  // Add more mappings as needed
};

const getDefaultLangCountry = () => ({ language: 'en', country: 'US' });

function getLangCountryFromUrl(imageUrl: string): { language: string; country: string } {
  try {
    // Do not attempt to parse TLD from data URLs
    if (imageUrl.startsWith('data:')) {
      return getDefaultLangCountry();
    }
    const parsedUrl = new URL(imageUrl);
    const hostname = parsedUrl.hostname;

    // Check for multi-part TLDs first (e.g., .co.uk, .com.au)
    for (const tld of Object.keys(tldToLangCountry)) {
      if (hostname.endsWith(tld)) {
        // Check if the part before the TLD is not empty (to avoid matching just .uk from .co.uk on a domain like example.uk)
        const domainPart = hostname.substring(0, hostname.length - tld.length);
        if (domainPart && domainPart.includes('.')) { // Ensure it's a valid subdomain or domain part
            return tldToLangCountry[tld];
        }
      }
    }
    
    // Check for single-part TLDs (e.g., .fr, .de)
    const parts = hostname.split('.');
    if (parts.length > 1) {
      const singleTld = '.' + parts[parts.length - 1];
      if (tldToLangCountry[singleTld]) {
        return tldToLangCountry[singleTld];
      }
    }

  } catch (e) {
    console.warn(`[AltTextLang] Could not parse URL or determine TLD for ${imageUrl}:`, e);
  }
  return getDefaultLangCountry();
}

export const POST = withAuthAndMonitoring(async (request: NextRequest, user) => {
  const supabaseAdmin = createSupabaseAdminClient();
  let historyEntryStatus: 'success' | 'failure' = 'success';
  let historyErrorMessage: string | undefined = undefined;
  const requestStartTime = Date.now(); // For logging overall request time if needed
  let apiInputs: AltTextGenerationRequest | null = null;
  let apiOutputs: { results: AltTextResultItem[] } | null = null;

  // Role check: Only Global Admins or Editors can access this tool
  const userRole = user.user_metadata?.role;
  if (!(userRole === 'admin' || userRole === 'editor')) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: You do not have permission to access this tool.' },
      { status: 403 }
    );
  }

  // Rate limiting logic
  const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown';
  const now = Date.now();

  if (rateLimit.has(ip)) {
    const userRateLimit = rateLimit.get(ip)!;
    if (now - userRateLimit.timestamp > RATE_LIMIT_PERIOD) {
      // Reset count if period has passed
      userRateLimit.count = 1;
      userRateLimit.timestamp = now;
    } else if (userRateLimit.count >= MAX_REQUESTS_PER_MINUTE) {
      console.warn(`[RateLimit] Blocked ${ip} for alt-text-generator. Count: ${userRateLimit.count}`);
      historyEntryStatus = 'failure';
      historyErrorMessage = 'Rate limit exceeded.';
      // Log history before returning
      try {
        await supabaseAdmin.from('tool_run_history').insert({
            user_id: user.id,
            tool_name: 'alt_text_generator',
            inputs: { error: 'Rate limit exceeded for initial request' }, // Or apiInputs if available
            outputs: { error: 'Rate limit exceeded' },
            status: historyEntryStatus,
            error_message: historyErrorMessage,
            brand_id: null // Alt text gen currently has no brand context
        });
      } catch (logError) {
        console.error('[HistoryLoggingError] Failed to log rate limit error for alt-text-generator:', logError);
      }
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      );
    } else {
      userRateLimit.count += 1;
    }
  } else {
    rateLimit.set(ip, { count: 1, timestamp: now });
  }

  try {
    const data: AltTextGenerationRequest = await request.json();
    apiInputs = data; // Capture inputs for logging
    
    if (!data.imageUrls || !Array.isArray(data.imageUrls) || data.imageUrls.length === 0) {
      historyEntryStatus = 'failure';
      historyErrorMessage = 'An array of image URLs is required';
      return NextResponse.json(
        { success: false, error: historyErrorMessage },
        { status: 400 }
      );
    }

    const results: AltTextResultItem[] = [];

    for (const imageUrl of data.imageUrls) {
      let requestedLanguage = data.language; // Get language from request if provided
      let language = 'en';
      let country = 'US';
      let processingError: string | undefined = undefined;

      try {
        // Validate URL structure before attempting to parse for TLD
        // Data URLs are valid but won't have a TLD for language detection
        if (!imageUrl.startsWith('data:')) {
            new URL(imageUrl);
        }
        
        if (requestedLanguage) {
          language = requestedLanguage;
          // Attempt to map language to a default country, or keep default US
          const langMap = Object.values(tldToLangCountry).find(lc => lc.language === language);
          country = langMap ? langMap.country : 'US'; 
        } else if (!imageUrl.startsWith('data:')) {
          // Fallback to TLD detection if no language explicitly passed and not a data URL
          const langCountry = getLangCountryFromUrl(imageUrl);
          language = langCountry.language;
          country = langCountry.country;
        } else {
          // For data URLs with no language passed, use default
          const defaultLangCountry = getDefaultLangCountry();
          language = defaultLangCountry.language;
          country = defaultLangCountry.country;
        }

      } catch (e: any) {
        console.error(`[AltTextGen] Invalid image URL format for TLD processing: ${imageUrl}:`, e);
        processingError = `Invalid image URL format.`;
        const defaultLangCountry = getDefaultLangCountry();
        language = requestedLanguage || defaultLangCountry.language; // Still prioritize requested lang if URL is bad
        country = defaultLangCountry.country;
      }

      if (processingError) {
        results.push({
          imageUrl,
          error: processingError,
        });
        historyEntryStatus = 'failure'; // Mark overall run as failure if any image fails
        if (!historyErrorMessage) historyErrorMessage = 'One or more images failed processing.'; 
        continue; // Skip to the next URL if the current one is invalid
      }
      
      try {
        // Brand context is currently empty, but kept for potential future use
        const brandContext = {
          brandIdentity: '',
          toneOfVoice: '',
          guardrails: ''
        };
        
        console.log(`[Delay] Alt-Text Gen: Waiting 5 seconds before AI call for ${imageUrl}...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log(`[Delay] Alt-Text Gen: Finished 5-second wait. Calling AI for ${imageUrl}...`);

        // console.log(`[AltTextGen] Generating for ${imageUrl} with lang: ${language}, country: ${country}`);
        const generatedAltTextResult = await generateAltText(
          imageUrl,
          language,
          country,
          brandContext
        );
        
        results.push({
          imageUrl,
          altText: generatedAltTextResult.altText, // Assuming altText is directly on the result
          // error: generatedAltTextResult.error, // If your generateAltText can return partial errors
        });

      } catch (error: any) {
        console.error(`[AltTextGen] Error calling generateAltText for ${imageUrl} (lang: ${language}, country: ${country}):`, error);
        results.push({
          imageUrl,
          error: error.message || 'Failed to generate alt text for this image.',
        });
        historyEntryStatus = 'failure'; // Mark overall run as failure if any image fails
        if (!historyErrorMessage) historyErrorMessage = 'One or more images failed AI generation.'; 
      }
    }
    
    apiOutputs = { results }; // Capture outputs for logging

    // Determine final history status based on individual image results
    if (results.some(r => r.error)) {
        historyEntryStatus = 'failure';
        if (!historyErrorMessage) historyErrorMessage = 'One or more images failed to generate alt text.';
    } else {
        historyEntryStatus = 'success';
    }

    return NextResponse.json({
      success: historyEntryStatus === 'success', // Reflect overall success
      userId: user.id,
      results,
      // Add overall error message if the entire operation is considered a failure
      ...(historyEntryStatus === 'failure' && historyErrorMessage && { error: historyErrorMessage })
    });

  } catch (error: any) {
    console.error('[AltTextGen] Global error in POST handler:', error);
    historyEntryStatus = 'failure';
    historyErrorMessage = error.message || 'An unexpected error occurred.';
    // Ensure apiInputs is at least an empty object if error happened before parsing request body
    if (!apiInputs) apiInputs = {imageUrls: [], language: 'unknown'}; 
    apiOutputs = { results: [{ imageUrl: 'unknown', error: historyErrorMessage }] };
    return handleApiError(new Error(historyErrorMessage), 'Alt Text Generation Error', 500);
  } finally {
    // Log to tool_run_history in all cases (success or failure)
    try {
      if (apiInputs) { // Only log if inputs were parsed or an attempt was made
        await supabaseAdmin.from('tool_run_history').insert({
            user_id: user.id,
            tool_name: 'alt_text_generator',
            inputs: apiInputs as unknown as Json,
            outputs: apiOutputs || { error: historyErrorMessage || 'Unknown error before output generation' } as unknown as Json,
            status: historyEntryStatus,
            error_message: historyErrorMessage,
            brand_id: null // Alt text generator is not brand-specific for history
        } as Database['public']['Tables']['tool_run_history']['Insert']);
      } else {
        // This case might happen if request.json() itself fails catastrophically before apiInputs is set
        // Or if a rate limit error occurred very early before apiInputs could be determined
        if (historyEntryStatus === 'failure' && historyErrorMessage) { // Only log if we have a specific error to log
             await supabaseAdmin.from('tool_run_history').insert({
                user_id: user.id,
                tool_name: 'alt_text_generator',
                inputs: { error: 'Failed to parse request or early error' },
                outputs: { error: historyErrorMessage },
                status: 'failure',
                error_message: historyErrorMessage,
                brand_id: null
            });
        }
      }
    } catch (logError) {
      console.error('[HistoryLoggingError] Failed to log run for alt-text-generator:', logError);
      // Do not let logging failure prevent the actual response from being sent
    }
  }
}); 