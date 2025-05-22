import { NextResponse, NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { handleApiError, isBuildPhase, isDatabaseConnectionError } from '@/lib/api-utils';
import { withAuth } from '@/lib/auth/api-auth';
import { Pool } from 'pg'; // Import Pool for direct DB access
import { getUserAuthByEmail, inviteNewUserWithAppMetadata } from '@/lib/auth/user-management';
import { User } from '@supabase/supabase-js';
import { extractCleanDomain } from '@/lib/utils/url-utils'; // Added import

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

// Configure the connection pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Type for priority as it comes from Supabase (enum string values)
type SupabaseVettingAgencyPriority = "High" | "Medium" | "Low" | null;

// Interface for vetting agency as it comes from Supabase
interface SupabaseVettingAgency {
  id: string;
  name: string;
  description: string | null;
  country_code: string;
  priority: SupabaseVettingAgencyPriority; // String-based priority
}

// Interface for vetting agency (TARGET type for FormattedBrand, with numeric priority)
interface VettingAgency {
  id: string;
  name: string;
  description: string | null;
  country_code: string;
  priority: number; // Numeric priority
}

// Interface for brand data as it comes from Supabase
interface BrandFromSupabase {
  id: string;
  name: string;
  website_url?: string | null;
  country?: string | null;
  language?: string | null;
  brand_identity?: string | null;
  tone_of_voice?: string | null;
  brand_summary?: string | null;
  brand_color?: string | null;
  approved_content_types?: any; 
  created_at: string | null;
  updated_at: string | null;
  content_count?: { count: number }[] | null; 
  // Updated to use SupabaseVettingAgency for the raw data
  selected_vetting_agencies?: { agency_id: string; content_vetting_agencies: SupabaseVettingAgency | null }[] | null; 
  [key: string]: any; 
}

// Helper function to map Supabase priority strings to numbers
function mapSupabasePriorityToNumber(priority: SupabaseVettingAgencyPriority): number {
  switch (priority) {
    case "High": return 1;
    case "Medium": return 2;
    case "Low": return 3;
    default: return Number.MAX_SAFE_INTEGER; // Default for null or unexpected values
  }
}

interface FormattedBrand {
  id: string;
  name: string;
  website_url?: string | null;
  country?: string | null;
  language?: string | null;
  brand_identity?: string | null;
  tone_of_voice?: string | null;
  brand_summary?: string | null;
  brand_color?: string | null;
  approved_content_types?: any;
  created_at?: string | null;
  updated_at?: string | null;
  content_count: number;
  selected_vetting_agencies: VettingAgency[]; // Uses VettingAgency with numeric priority
  [key: string]: any;
}

// Sample fallback data for when DB connection fails
const getFallbackBrands = (): FormattedBrand[] => {
  return [
    {
      id: '1',
      name: 'Sample Brand',
      website_url: 'https://example.com',
      country: 'United States',
      language: 'English',
      brand_identity: 'Modern and innovative',
      tone_of_voice: 'Professional but friendly',
      brand_summary: 'Modern and innovative brand with a professional but friendly tone.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      content_count: 5,
      brand_color: '#3498db',
      selected_vetting_agencies: [] as VettingAgency[] 
    },
    {
      id: '2',
      name: 'Another Brand',
      website_url: 'https://another-example.com',
      country: 'United Kingdom',
      language: 'English',
      brand_identity: 'Traditional and trusted',
      tone_of_voice: 'Formal and authoritative',
      brand_summary: 'Traditional and trusted brand with a formal and authoritative tone.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      content_count: 3,
      brand_color: '#e74c3c',
      selected_vetting_agencies: [] as VettingAgency[] 
    }
  ];
};

type UserRole = 'admin' | 'editor' | 'viewer'; // Temporary: align with current DB schema

// Authenticated GET handler for brands
export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (isBuildPhase()) {
      console.log('Returning mock brands during build');
      return NextResponse.json({ 
        success: true, 
        isMockData: true,
        data: getFallbackBrands()
      });
    }
    
    console.log('Attempting to fetch brands from database');
    const supabase = createSupabaseAdminClient();
    
    const globalRole = user?.user_metadata?.role;
    console.log('User global role:', globalRole); 

    let brandsQuery = supabase
      .from('brands')
      .select('*, content_count:content(count), selected_vetting_agencies:brand_selected_agencies(agency_id, content_vetting_agencies(id, name, description, country_code, priority))');

    if (globalRole !== 'admin') {
      // Fetch brand_permissions directly for the user if they are not a global admin
      console.log(`User ${user.id} is not a global admin. Fetching specific brand permissions.`);
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('user_brand_permissions')
        .select('brand_id')
        .eq('user_id', user.id);

      if (permissionsError) {
        console.error(`[API Brands GET] Error fetching brand permissions for user ${user.id}:`, permissionsError);
        // Potentially return error or handle appropriately, for now, let it fall through to an empty list if query fails this way
        // but ideally, this should be a hard error.
        return handleApiError(permissionsError, 'Failed to fetch user brand permissions');
      }

      if (!permissionsData || permissionsData.length === 0) {
        console.log(`[API Brands GET] Non-admin user ${user.id} has no brand permissions in user_brand_permissions table. Returning empty array.`);
        return NextResponse.json({ success: true, data: [] });
      }
      
      const permittedBrandIds = permissionsData.map(p => p.brand_id).filter(id => id != null);
      
      if (permittedBrandIds.length === 0) {
        console.log(`[API Brands GET] Non-admin user ${user.id} has no valid brand IDs after fetching permissions. Returning empty array.`);
        return NextResponse.json({ success: true, data: [] });
      }
      
      console.log(`[API Brands GET] User ${user.id} (role: ${globalRole}) has permitted brand IDs: ${permittedBrandIds.join(', ')}. Applying filter.`);
      brandsQuery = brandsQuery.in('id', permittedBrandIds);
    } else {
      console.log(`User ${user.id} is a global admin. Fetching all brands.`);
    }
    
    const { data: brandsData, error } = await brandsQuery.order('name');
    
    if (error) {
      console.error('Error executing brands query:', error);
      throw error;
    }
    
    console.log('Brands data fetched from database:', brandsData); // Log the raw data fetched
    
    const brandsDataCast = brandsData as BrandFromSupabase[] | null;

    const formattedBrands: FormattedBrand[] = (brandsDataCast || []).map((brand: BrandFromSupabase) => {
      let agencies: VettingAgency[] = []; 
      if (brand.selected_vetting_agencies && Array.isArray(brand.selected_vetting_agencies)) {
        agencies = brand.selected_vetting_agencies
          .map(item => {
            const supabaseAgency = item.content_vetting_agencies; // Type: SupabaseVettingAgency | null
            if (supabaseAgency) {
              return { // Convert to VettingAgency with numeric priority
                id: supabaseAgency.id,
                name: supabaseAgency.name,
                description: supabaseAgency.description,
                country_code: supabaseAgency.country_code,
                priority: mapSupabasePriorityToNumber(supabaseAgency.priority),
              } as VettingAgency;
            }
            return null;
          })
          .filter((agency): agency is VettingAgency => agency !== null) // Type guard and filter nulls
          .sort((a, b) => { // Sort by numeric priority, then name
            if (a.priority !== b.priority) {
              return a.priority - b.priority;
            }
            return (a.name || '').localeCompare(b.name || '');
          });
      }
      return {
        id: brand.id,
        name: brand.name,
        website_url: brand.website_url,
        country: brand.country,
        language: brand.language,
        brand_identity: brand.brand_identity,
        tone_of_voice: brand.tone_of_voice,
        brand_summary: brand.brand_summary,
        brand_color: brand.brand_color,
        approved_content_types: brand.approved_content_types,
        created_at: brand.created_at,
        updated_at: brand.updated_at,
        content_count: brand.content_count && brand.content_count[0] ? brand.content_count[0].count : 0,
        selected_vetting_agencies: agencies, // Now correctly typed and sorted
      };
    });

    console.log(`Successfully fetched ${formattedBrands.length} brands`);
    
    return NextResponse.json({ 
      success: true, 
      data: formattedBrands 
    });
  } catch (error: any) {
    console.error('Error fetching brands:', error);
    
    if (isDatabaseConnectionError(error)) {
      console.error('Database connection error, using fallback brands data:', error);
      return NextResponse.json({ 
        success: true, 
        isFallback: true,
        data: getFallbackBrands()
      });
    }
    
    return handleApiError(error, 'Error fetching brands');
  }
});

// Authenticated POST handler for creating brands
export const POST = withAuth(async (req: NextRequest, user) => {
  // Role check: Only Global Admins can create new brands
  if (user.user_metadata?.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: You do not have permission to create this resource.' },
      { status: 403 }
    );
  }

  const supabase = createSupabaseAdminClient(); 
  // const dbClient = await pool.connect(); // Temporarily comment out pg pool for focusing on Supabase client logic
  try {
    // await dbClient.query('BEGIN'); 
    const body = await req.json();
    
    if (!body.name) {
      // await dbClient.query('ROLLBACK');
      // dbClient.release();
      return NextResponse.json(
        { success: false, error: 'Brand name is required' },
        { status: 400 }
      );
    }
    
    let formattedGuardrails = body.guardrails || null;
    if (formattedGuardrails) {
      if (Array.isArray(formattedGuardrails)) {
        formattedGuardrails = formattedGuardrails.map((item:string) => `- ${item}`).join('\\n');
      } 
      else if (typeof formattedGuardrails === 'string' && 
              formattedGuardrails.trim().startsWith('[') && 
              formattedGuardrails.trim().endsWith(']')) {
        try {
          const guardrailsArray = JSON.parse(formattedGuardrails);
          if (Array.isArray(guardrailsArray)) {
            formattedGuardrails = guardrailsArray.map((item:string) => `- ${item}`).join('\\n');
          }
        } catch (e) { /* ignore */ }
      }
    }

    const rpcParams = {
      creator_user_id: user.id,
      brand_name: body.name,
      brand_website_url: body.website_url || null,
      brand_country: body.country || null,
      brand_language: body.language || null,
      brand_identity_text: body.brand_identity || null,
      brand_tone_of_voice: body.tone_of_voice || null,
      brand_guardrails: formattedGuardrails,
      brand_content_vetting_agencies_input: body.selected_agency_ids || null, 
      brand_color_input: body.brand_color || null, 
      approved_content_types_input: body.approved_content_types || null 
    };

    const { data: newBrandId, error: rpcError } = await supabase.rpc(
      'create_brand_and_set_admin' as any,
      rpcParams
    );

    if (rpcError) {
      console.error('RPC Error creating brand:', rpcError);
      throw new Error(`Failed to create brand: ${rpcError.message}`);
    }

    if (!newBrandId) {
      throw new Error('Failed to create brand, no ID returned from function.');
    }

    // Populate normalized_website_domain
    if (body.website_url) {
      const normalizedDomain = extractCleanDomain(body.website_url);
      if (normalizedDomain) {
        const { error: updateDomainError } = await supabase
          .from('brands')
          .update({ normalized_website_domain: normalizedDomain })
          .eq('id', newBrandId);
        
        if (updateDomainError) {
          // Log the error but don't fail the brand creation, as the primary record is made
          console.warn(`[API /api/brands POST] Failed to update normalized_website_domain for new brand ${newBrandId}: ${updateDomainError.message}`);
        }
      }
    }
    
    // --- Process Additional Brand Admins ---
    const adminIdentifiers: string[] = body.brand_admin_ids || [];
    const resolvedAdminUserIds: string[] = []; // To store IDs of existing or successfully invited new admins

    for (const identifier of adminIdentifiers) {
      if (identifier === user.id) continue; // Skip creator, already handled by RPC

      let adminUser: User | null = null;
      let isNewAdmin = false;

      // Check if identifier is an email (for potential new user)
      if (identifier.includes('@')) { 
        adminUser = await getUserAuthByEmail(identifier, supabase);
        if (!adminUser) {
          // User does not exist, invite them
          console.log(`[API /api/brands POST] Admin email ${identifier} not found. Inviting as new user for brand ${newBrandId}.`);
          const appMetadata = { 
            intended_role: 'admin', 
            assigned_as_brand_admin_for_brand_id: newBrandId,
            inviter_id: user.id, 
            invite_type: 'brand_admin_invite' 
          };
          const userMetadata = { email_for_invite: identifier }; // Minimal user metadata

          const { user: invitedAdmin, error: inviteError } = await inviteNewUserWithAppMetadata(
            identifier, 
            appMetadata, 
            supabase,
            userMetadata
          );

          if (inviteError || !invitedAdmin) {
            console.warn(`[API /api/brands POST] Failed to invite new admin ${identifier} for brand ${newBrandId}. Error: ${inviteError?.message}`);
            // Decide on error handling: skip this admin, or fail request? For now, skip.
            continue;
          }
          adminUser = invitedAdmin;
          isNewAdmin = true;
          console.log(`[API /api/brands POST] Successfully invited new admin ${identifier} (ID: ${adminUser.id}) for brand ${newBrandId}.`);
        }
      } else {
        // Identifier is assumed to be an existing user ID
        // Fetch user to confirm existence (optional, but good practice if ID source isn't guaranteed)
        // For now, assume valid ID if not email
        adminUser = { id: identifier } as User; // Partial User object, sufficient if just using ID
      }

      if (adminUser && adminUser.id) {
        if (!isNewAdmin) { // For existing users, add their ID directly for permission upsert
          resolvedAdminUserIds.push(adminUser.id);
        }
        // For new admins, permissions will be set via complete-invite using app_metadata.
        // No immediate permission upsert here for newly invited users.
      }
    }

    if (resolvedAdminUserIds.length > 0) {
      const permissionUpserts = resolvedAdminUserIds.map((adminId: string) => ({
        user_id: adminId,
        brand_id: newBrandId as string,
        role: 'admin' as UserRole,
      }));

      const { error: permissionError } = await supabase.from('user_brand_permissions').upsert(permissionUpserts, { onConflict: 'user_id,brand_id' });

      if (permissionError) {
        console.error('[API /api/brands POST] Error setting brand admin permissions for existing users:', permissionError);
        // Non-critical if some permissions fail for existing users? Or rollback?
        // For now, log and continue.
      }
    }
    // --- End Process Additional Brand Admins ---

    if (body.selected_agency_ids && Array.isArray(body.selected_agency_ids) && body.selected_agency_ids.length > 0) {
      // Fetch existing agency links for this brand to avoid duplicate inserts
      const { data: existingLinks, error: fetchLinksError } = await supabase
        .from('brand_selected_agencies')
        .select('agency_id')
        .eq('brand_id', newBrandId);

      if (fetchLinksError) {
        console.warn(`[API /api/brands POST] Error fetching existing agency links for brand ${newBrandId}:`, fetchLinksError);
        // Decide if this is critical. For now, proceed cautiously.
      }

      const existingAgencyIds = existingLinks ? existingLinks.map(link => link.agency_id) : [];
      const newAgencyIdsToInsert = body.selected_agency_ids.filter((agencyId: string) => !existingAgencyIds.includes(agencyId));

      if (newAgencyIdsToInsert.length > 0) {
        const agencyInserts = newAgencyIdsToInsert.map((agencyId: string) => ({
          brand_id: newBrandId,
          agency_id: agencyId
        }));
        
        const { error: agencyError } = await supabase
          .from('brand_selected_agencies')
          .insert(agencyInserts);

        if (agencyError) {
          console.warn('[API /api/brands POST] Error linking new agencies to brand:', agencyError);
          // Log and continue, as brand creation itself was successful.
        }
      }
    }

    // Fetch the newly created brand data using Supabase client
    const { data: newBrandDataFromDB, error: fetchBrandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', newBrandId)
      .single();

    if (fetchBrandError || !newBrandDataFromDB) {
      // await dbClient.query('ROLLBACK');
      // dbClient.release();
      throw new Error(fetchBrandError?.message || 'Failed to fetch newly created brand after commit.');
    }

    // Fetch selected agencies with Supabase client
    const { data: finalSelectedSupabaseAgencies, error: fetchAgenciesError } = await supabase
      .from('brand_selected_agencies')
      .select(`agency_id, content_vetting_agencies (id, name, description, country_code, priority)`)
      .eq('brand_id', newBrandId);
    
    if (fetchAgenciesError) {
        console.warn('[API /api/brands POST] Error fetching agencies for new brand:', fetchAgenciesError);
    }

    const finalSelectedVettingAgencies: VettingAgency[] = (finalSelectedSupabaseAgencies || [])
      .map((item: any) => {
        const sa = item.content_vetting_agencies;
        if (!sa) return null;
        return {
          id: sa.id,
          name: sa.name,
          description: sa.description,
          country_code: sa.country_code,
          priority: mapSupabasePriorityToNumber(sa.priority as SupabaseVettingAgencyPriority),
        };
      })
      .filter((agency): agency is VettingAgency => agency !== null)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return (a.name || '').localeCompare(b.name || '');
      });

    const finalResponseData: FormattedBrand = {
      ...(newBrandDataFromDB as unknown as FormattedBrand), // Cast after ensuring all fields match
      id: newBrandDataFromDB.id!,
      name: newBrandDataFromDB.name!,
      content_count: 0, 
      selected_vetting_agencies: finalSelectedVettingAgencies,
    };

    // await dbClient.query('COMMIT'); 
    return NextResponse.json({ 
      success: true, 
      data: finalResponseData 
    });

  } catch (error) {
    // await dbClient.query('ROLLBACK');
    return handleApiError(error, 'Error creating brand');
  } finally {
    // dbClient.release();
  }
}); 