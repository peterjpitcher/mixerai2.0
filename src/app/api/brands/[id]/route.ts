import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { handleApiError } from '@/lib/api-utils';
import { withAuth } from '@/lib/auth/api-auth';
import { isBrandAdmin } from '@/lib/auth/api-auth';
import { getUserAuthByEmail, inviteNewUserWithAppMetadata } from '@/lib/auth/user-management';
import { User } from '@supabase/supabase-js'; // Ensure User type is available
import { extractCleanDomain } from '@/lib/utils/url-utils'; // Added import

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

// Type for priority as it comes from Supabase (enum string values)
// Define these types and helper here as well for this route file
type SupabaseVettingAgencyPriority = "High" | "Medium" | "Low" | null;

// Helper function to map Supabase priority strings to numbers
function mapSupabasePriorityToNumber(priority: SupabaseVettingAgencyPriority): number {
  switch (priority) {
    case "High": return 1;
    case "Medium": return 2;
    case "Low": return 3;
    default: return Number.MAX_SAFE_INTEGER; // Default for null or unexpected values
  }
}

// Interface for vetting agency with numeric priority (for API response)
interface VettingAgencyForResponse {
  id: string;
  name: string;
  description: string | null;
  country_code: string;
  priority: number; // Numeric priority
  // Add other fields if the original SupabaseVettingAgency had more that are needed.
}

// GET a single brand by ID
export const GET = withAuth(async (
  request: NextRequest,
  user: any,
  { params }: { params: { id: string } }
) => {
  try {
    const supabase = createSupabaseAdminClient();
    const { id: brandId } = params;

    // Role and Permission Check
    const isGlobalAdmin = user.user_metadata?.role === 'admin';

    if (!isGlobalAdmin) {
      // If not a global admin, check if the user has any permission for this specific brand
      const { data: permission, error: permError } = await supabase
        .from('user_brand_permissions')
        .select('brand_id')
        .eq('user_id', user.id)
        .eq('brand_id', brandId)
        .maybeSingle(); // Use maybeSingle as we only need to know if at least one exists

      if (permError) {
        console.error(`[API Brands GET /${brandId}] Error checking brand permissions for user ${user.id}:`, permError);
        return handleApiError(permError, 'Error checking brand permissions');
      }

      if (!permission) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You do not have permission to access this brand.' },
          { status: 403 }
        );
      }
    }
    // If global admin or has specific permission, proceed to fetch brand details

    const { data: brandData, error: brandFetchError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single();
    
    if (brandFetchError) {
        throw brandFetchError;
    }
    
    if (!brandData) {
      return NextResponse.json(
        { success: false, error: 'Brand not found' },
        { 
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
        }
      );
    }

    const { data: selectedAgenciesData, error: selectedAgenciesError } = await supabase
      .from('brand_selected_agencies')
      .select(`
        agency_id,
        content_vetting_agencies (
          id,
          name,
          description,
          country_code,
          priority
        )
      `)
      .eq('brand_id', brandId);

    if (selectedAgenciesError) {
      console.error('Error fetching selected agencies with Supabase:', selectedAgenciesError);
      throw selectedAgenciesError;
    }

    let processedAgencies: VettingAgencyForResponse[] = [];
    if (selectedAgenciesData) {
      processedAgencies = selectedAgenciesData
        .map(item => {
            const agencyFromDb = item.content_vetting_agencies;
            if (agencyFromDb) {
                return {
                    id: agencyFromDb.id,
                    name: agencyFromDb.name,
                    description: agencyFromDb.description,
                    country_code: agencyFromDb.country_code,
                    priority: mapSupabasePriorityToNumber(agencyFromDb.priority as SupabaseVettingAgencyPriority),
                    // Include other fields from agencyFromDb if they were part of its original type
                    // and are expected in VettingAgencyForResponse
                } as VettingAgencyForResponse;
            }
            return null;
        })
        .filter((agency): agency is VettingAgencyForResponse => agency !== null) // Filter out nulls and type guard
        .sort((a, b) => { // Sort by numeric priority then name
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          return (a.name || '').localeCompare(b.name || '');
        });
    }
    
    const brand: any = brandData;
    brand.selected_vetting_agencies = processedAgencies; // Assign agencies with numeric priority

    // Fetch Brand Admins
    const { data: adminPermissions, error: adminPermissionsError } = await supabase
      .from('user_brand_permissions')
      .select('user_id, profiles (id, full_name, email, avatar_url, job_title)') // Assuming profiles table exists and is linked
      .eq('brand_id', brandId)
      .eq('role', 'admin');

    if (adminPermissionsError) {
      console.error('Error fetching brand admins:', adminPermissionsError);
      throw adminPermissionsError;
    }

    const adminUsers = adminPermissions?.map(p => p.profiles).filter(profile => profile !== null) || [];
    brand.admins = adminUsers; // Add admins to the brand object

    const { count: contentCount, error: contentCountError } = await supabase
      .from('content')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId);
      
    if (contentCountError) throw contentCountError; 
    
    const { count: workflowCount, error: workflowCountError } = await supabase
      .from('workflows')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId);
      
    if (workflowCountError) throw workflowCountError;

    return NextResponse.json({ 
      success: true, 
      brand, // brand now contains selected_vetting_agencies with numeric priorities
      contentCount: contentCount || 0,
      workflowCount: workflowCount || 0,
      meta: {
        source: 'database (Supabase)',
        isFallback: false,
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      }
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
        'x-data-source': 'database (Supabase)'
      }
    });
  } catch (error: any) {
    return handleApiError(error, 'Error fetching brand');
  }
});

// PUT endpoint to update a brand
export const PUT = withAuth(async (
  request: NextRequest,
  authenticatedUser: any, // Renamed 'user' to 'authenticatedUser' to avoid conflict with 'adminUser' variable
  context: { params: { id: string } }
) => {
  const supabase = createSupabaseAdminClient();
  try {
    const brandIdToUpdate = context.params.id;

    // Check if the authenticated user is a global admin
    const isGlobalAdmin = authenticatedUser.user_metadata?.role === 'admin';

    if (!isGlobalAdmin) {
      // If not a global admin, check for specific brand admin rights
      const hasBrandAdminPermission = await isBrandAdmin(authenticatedUser.id, brandIdToUpdate, supabase);
      if (!hasBrandAdminPermission) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You do not have admin rights for this brand.' },
          { status: 403 }
        );
      }
    }
    // If the user is a global admin, or has specific brand admin rights, proceed.

    const body = await request.json();
    
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Brand name is required' },
        { status: 400 }
      );
    }
    
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.website_url !== undefined) {
      updateData.website_url = body.website_url;
      // Also update normalized_website_domain if website_url is changing
      if (body.website_url === null || body.website_url.trim() === '') {
        updateData.normalized_website_domain = null;
      } else {
        const normalizedDomain = extractCleanDomain(body.website_url);
        updateData.normalized_website_domain = normalizedDomain;
      }
    }
    if (body.country !== undefined) updateData.country = body.country;
    if (body.language !== undefined) updateData.language = body.language;
    if (body.brand_identity !== undefined) updateData.brand_identity = body.brand_identity;
    if (body.tone_of_voice !== undefined) updateData.tone_of_voice = body.tone_of_voice;
    if (body.brand_color !== undefined) updateData.brand_color = body.brand_color;
    if (body.approved_content_types !== undefined) updateData.approved_content_types = body.approved_content_types;
    
    if (body.brand_summary !== undefined) {
      updateData.brand_summary = body.brand_summary;
    } else if (body.brand_identity !== undefined && (body.brand_identity !== "")) {
      updateData.brand_summary = body.brand_identity.slice(0, 250);
      if (body.brand_identity.length > 250) {
        updateData.brand_summary += '...';
      }
    }
    
    if (body.guardrails !== undefined) {
      let formattedGuardrails = body.guardrails;
      if (Array.isArray(body.guardrails)) {
        formattedGuardrails = body.guardrails.map((item:string) => `- ${item}`).join('\n');
      } 
      else if (typeof body.guardrails === 'string' && 
               body.guardrails.trim().startsWith('[') && 
               body.guardrails.trim().endsWith(']')) {
        try {
          const guardrailsArray = JSON.parse(body.guardrails);
          if (Array.isArray(guardrailsArray)) {
            formattedGuardrails = guardrailsArray.map((item:string) => `- ${item}`).join('\n');
          }
        } catch (e) { /* ignore */ }
      }
      updateData.guardrails = formattedGuardrails;
    }
    
    // --- START: Updated Brand Admin Processing ---
    const newAdminIdentifiersFromRequest: string[] = body.brand_admin_ids || [];
    const existingAdminUserIdsToKeepOrAdd: string[] = [];
    
    // 1. Get current admins for this brand from DB
    const { data: currentPermissions, error: currentPermissionsError } = await supabase
      .from('user_brand_permissions')
      .select('user_id')
      .eq('brand_id', brandIdToUpdate)
      .eq('role', 'admin');

    if (currentPermissionsError) {
      console.error('[API /api/brands PUT] Error fetching current brand permissions:', currentPermissionsError);
      throw currentPermissionsError;
    }
    const currentAdminDbIds = currentPermissions ? currentPermissions.map(p => p.user_id) : [];

    // 2. Process identifiers from request (can be emails for new users, or IDs for existing)
    for (const identifier of newAdminIdentifiersFromRequest) {
      let adminUserToProcess: User | null = null;

      if (identifier.includes('@')) { // Assumed to be an email
        const existingAuthUser = await getUserAuthByEmail(identifier, supabase);
        if (existingAuthUser) {
          adminUserToProcess = existingAuthUser;
        } else {
          // New user: invite them
          console.log(`[API /api/brands PUT] Admin email ${identifier} not found. Inviting as new user for brand ${brandIdToUpdate}.`);
          const appMetadata = { 
            intended_role: 'admin', 
            assigned_as_brand_admin_for_brand_id: brandIdToUpdate,
            inviter_id: authenticatedUser.id, 
            invite_type: 'brand_admin_invite_on_update' 
          };
          const userMetadata = { email_for_invite: identifier };

          const { user: invitedAdmin, error: inviteError } = await inviteNewUserWithAppMetadata(
            identifier, 
            appMetadata, 
            supabase,
            userMetadata
          );

          if (inviteError || !invitedAdmin) {
            console.warn(`[API /api/brands PUT] Failed to invite new admin ${identifier} for brand ${brandIdToUpdate}. Error: ${inviteError?.message}. Skipping this admin.`);
            continue; // Skip this problematic invite
          }
          // For newly invited users, their permissions will be set by complete-invite.
          // We don't add them to existingAdminUserIdsToKeepOrAdd yet, as they need to accept invite.
          console.log(`[API /api/brands PUT] Successfully invited new admin ${identifier} (ID: ${invitedAdmin.id}) for brand ${brandIdToUpdate}.`);
          continue; // Move to next identifier
        }
      } else { // Assumed to be a user ID
        // Here, we could fetch the user by ID to confirm they exist in auth.users
        // For simplicity, if it's a UUID, assume it's a valid existing user ID for now.
        // A more robust check would be `supabase.auth.admin.getUserById(identifier)`
        adminUserToProcess = { id: identifier } as User; // Partial, but ID is what we need
      }

      if (adminUserToProcess && adminUserToProcess.id) {
        existingAdminUserIdsToKeepOrAdd.push(adminUserToProcess.id);
      }
    }
    
    // 3. Determine admins to remove from permissions
    // These are admins currently in DB but NOT in the list of existing users to keep/add from request
    const adminsToRemoveFromDb = currentAdminDbIds.filter(id => id !== null && !existingAdminUserIdsToKeepOrAdd.includes(id));
    if (adminsToRemoveFromDb.length > 0) {
      const { error: deleteAdminsError } = await supabase
        .from('user_brand_permissions')
        .delete()
        .eq('brand_id', brandIdToUpdate)
        .in('user_id', adminsToRemoveFromDb)
        .eq('role', 'admin');
      if (deleteAdminsError) {
        console.error('[API /api/brands PUT] Error removing old brand admins:', deleteAdminsError);
        // Log and continue, or throw depending on desired strictness
      }
    }

    // 4. Upsert permissions for existing users who should be admins
    // (either they were already admin and are kept, or are existing users newly added as admin)
    if (existingAdminUserIdsToKeepOrAdd.length > 0) {
      const upsertOperations = existingAdminUserIdsToKeepOrAdd.map(adminId => ({
        user_id: adminId,
        // @ts-ignore - brandIdToUpdate is string due to route param & prior checks
        brand_id: brandIdToUpdate as string, 
        role: 'admin' as 'admin',
      }));
      const { error: upsertAdminsError } = await supabase
        .from('user_brand_permissions')
        .upsert(upsertOperations, { onConflict: 'user_id,brand_id' });
      if (upsertAdminsError) {
        console.error('[API /api/brands PUT] Error upserting brand admin permissions for existing users:', upsertAdminsError);
      }
    }
    // --- END: Updated Brand Admin Processing ---
    
    let updatedSupabaseBrandData: any = null;
    if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date().toISOString();
        const { data, error } = await supabase
          .from('brands')
          .update(updateData)
          .eq('id', brandIdToUpdate)
          .select()
          .single();
        if (error) throw error;
        if (!data) {
            return NextResponse.json(
              { success: false, error: 'Brand not found after attempting update with Supabase' },
              { status: 404 }
            );
        }
        updatedSupabaseBrandData = data;
    } else {
      // If only admins or agencies changed, still need to fetch the brand data
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandIdToUpdate)
        .single();
      if (error) throw error;
      if (!data) {
        return NextResponse.json( { success: false, error: 'Brand not found' }, { status: 404 });
      }
      updatedSupabaseBrandData = data;
    }
    
    // First, delete all existing links for this brand
    const { error: deleteAgenciesError } = await supabase
      .from('brand_selected_agencies')
      .delete()
      .eq('brand_id', brandIdToUpdate);

    if (deleteAgenciesError) {
      console.error('[API /api/brands PUT] Error deleting old brand agencies:', deleteAgenciesError);
      throw deleteAgenciesError;
    }

    // Then, insert the new set of links
    if (body.selected_agency_ids && Array.isArray(body.selected_agency_ids) && body.selected_agency_ids.length > 0) {
      let resolvedAgencyIds: string[] = [];
      const submittedIds = body.selected_agency_ids as string[];
      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

      // Check if the first item looks like a UUID to determine input type
      // This is a heuristic; a more robust way might be an explicit param from frontend
      const firstItemIsLikelyUuid = uuidRegex.test(submittedIds[0]);

      if (firstItemIsLikelyUuid) {
        console.log("[API /api/brands PUT] Assuming selected_agency_ids are UUIDs.");
        resolvedAgencyIds = submittedIds.filter(id => {
          if (!uuidRegex.test(id)) {
            console.warn(`[API /api/brands PUT] Invalid UUID format for agencyId: "${id}" in an array assumed to be UUIDs. Skipping.`);
            return false;
          }
          return true;
        });
      } else {
        console.log("[API /api/brands PUT] Assuming selected_agency_ids are names. Attempting to resolve to UUIDs.");
        const agencyNamesToLookup = submittedIds;
        const brandCountryForLookup = updatedSupabaseBrandData?.country || body.country;

        if (agencyNamesToLookup.length > 0 && brandCountryForLookup) {
          const { data: agenciesFromDb, error: fetchAgenciesError } = await supabase
            .from('content_vetting_agencies')
            .select('id, name')
            .in('name', agencyNamesToLookup)
            .eq('country_code', brandCountryForLookup); // Use brand's country for context

          if (fetchAgenciesError) {
            console.error('[API /api/brands PUT] Error fetching agencies by name:', fetchAgenciesError);
            // Decide if to throw or proceed with successfully resolved ones
          } else if (agenciesFromDb) {
            const nameToIdMap = new Map(agenciesFromDb.map(a => [a.name, a.id]));
            agencyNamesToLookup.forEach(name => {
              const foundId = nameToIdMap.get(name);
              if (foundId) {
                resolvedAgencyIds.push(foundId);
              } else {
                console.warn(`[API /api/brands PUT] Agency name "${name}" for country ${brandCountryForLookup} not found in database. Skipping.`);
              }
            });
          }
        } else if (!brandCountryForLookup) {
            console.warn("[API /api/brands PUT] Cannot resolve agency names to IDs because brand country is not available.");
        }
      }

      if (resolvedAgencyIds.length > 0) {
        const agenciesToInsert = resolvedAgencyIds.map(agencyId => ({
          brand_id: brandIdToUpdate,
          agency_id: agencyId, // This should now always be a UUID
        }));

        const { error: insertAgenciesError } = await supabase
          .from('brand_selected_agencies')
          .insert(agenciesToInsert);

        if (insertAgenciesError) {
          console.error('[API /api/brands PUT] Error inserting new brand agencies (with resolved IDs):', insertAgenciesError);
          throw insertAgenciesError;
        }
        console.log(`[API /api/brands PUT] Successfully inserted/updated ${agenciesToInsert.length} agency links.`);
      } else {
        console.log("[API /api/brands PUT] No valid agency IDs to insert after resolution.");
      }
    }
    
    // Fetch final state of selected agencies to return in response
    const { data: finalSelectedAgenciesData, error: finalAgenciesError } = await supabase
      .from('brand_selected_agencies')
      .select(`
        agency_id,
        content_vetting_agencies (
          id,
          name,
          description,
          country_code,
          priority
        )
      `)
      .eq('brand_id', brandIdToUpdate);

    if (finalAgenciesError) {
      console.error('Error fetching final selected agencies with Supabase:', finalAgenciesError);
      throw finalAgenciesError;
    }
    
    let finalProcessedAgencies: VettingAgencyForResponse[] = [];
    if (finalSelectedAgenciesData) {
      finalProcessedAgencies = finalSelectedAgenciesData
        .map(item => {
            const agencyFromDb = item.content_vetting_agencies;
            if (agencyFromDb) {
                return {
                    id: agencyFromDb.id,
                    name: agencyFromDb.name,
                    description: agencyFromDb.description,
                    country_code: agencyFromDb.country_code,
                    priority: mapSupabasePriorityToNumber(agencyFromDb.priority as SupabaseVettingAgencyPriority),
                } as VettingAgencyForResponse;
            }
            return null;
        })
        .filter((agency): agency is VettingAgencyForResponse => agency !== null)
        .sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          return (a.name || '').localeCompare(b.name || '');
        });
    }

    const finalBrandResponse: any = updatedSupabaseBrandData;
    finalBrandResponse.selected_vetting_agencies = finalProcessedAgencies;
    // Ensure `admins` are also part of the final response if fetched/updated
    // For now, GET /api/brands/[id] is responsible for returning admins.
    // This PUT response primarily confirms the brand update.

    return NextResponse.json({ 
      success: true, 
      brand: finalBrandResponse // Contains updated brand fields and new agency list
    });

  } catch (error) {
    console.error('Error in PUT /api/brands/[id]:', error);
    return handleApiError(error, 'Error updating brand');
  }
});

// DELETE a brand by ID (logic remains largely unchanged as it was already Supabase-centric)
export const DELETE = withAuth(async (
  request: NextRequest,
  user: any,
  context: { params: { id: string } }
) => {
  try {
    const supabase = createSupabaseAdminClient();
    const brandIdToDelete = context.params.id;
    
    // Role check: Only Global Admins can delete brands
    if (user.user_metadata?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You do not have permission to delete this resource.' },
        { status: 403 }
      );
    }
    // If we reach here, user is a Global Admin

    const url = new URL(request.url);
    const deleteCascade = url.searchParams.get('deleteCascade') === 'true';
    
    const { data: brandToCheck, error: fetchError } = await supabase
      .from('brands')
      .select('id, name')
      .eq('id', brandIdToDelete)
      .maybeSingle();
    
    if (fetchError && fetchError.code !== 'PGRST116') { 
        throw fetchError;
    }
    if (!brandToCheck) {
      return NextResponse.json(
        { success: false, error: 'Brand not found' },
        { status: 404 }
      );
    }
    
    if (!deleteCascade) {
      const { count: contentCount, error: contentCountErr } = await supabase
        .from('content')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandIdToDelete);
      if (contentCountErr) throw contentCountErr;
      
      const { count: workflowCount, error: workflowCountErr } = await supabase
        .from('workflows')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandIdToDelete);
      if (workflowCountErr) throw workflowCountErr;
      
      const contentCountValue = contentCount || 0;
      const workflowCountValue = workflowCount || 0;
      
      if (contentCountValue > 0 || workflowCountValue > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Cannot delete brand. It has ${contentCountValue} piece${contentCountValue === 1 ? '' : 's'} of content and ${workflowCountValue} workflow${workflowCountValue === 1 ? '' : 's'} associated. Use deleteCascade=true to override.`,
            contentCount: contentCountValue,
            workflowCount: workflowCountValue,
            requiresCascade: true
          },
          { status: 400 } 
        );
      }
    }
    
    const { error: rpcError } = await supabase.rpc('delete_brand_and_dependents', {
      brand_id_to_delete: brandIdToDelete
    });

    if (rpcError) {
      console.error('Error calling delete_brand_and_dependents RPC:', rpcError);
      if (rpcError.code === 'P0001' && rpcError.message.includes('Brand not found')) { 
           return NextResponse.json({ success: false, error: 'Brand not found or already deleted.' }, { status: 404 });
      }
      const detailedError = new Error(`RPC Error: ${rpcError.message} (Code: ${rpcError.code}) Details: ${rpcError.details} Hint: ${rpcError.hint}`);
      (detailedError as any).cause = rpcError;
      throw detailedError;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Brand "${brandToCheck.name}" and its direct dependents have been scheduled for deletion.` 
    });

  } catch (error) {
    console.error('Full error in DELETE /api/brands/[id]:', error);
    return handleApiError(error, 'Error deleting brand');
  }
}); 