import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Define UserRoles type alias locally for convenience if needed, or use directly
type UserRoles = Database['public']['Enums']['user_role'];

interface InviteMetadata {
  source: 'direct_admin' | 'brand_assignment' | 'workflow_assignment' | 'unknown';
  intendedRole: UserRoles | null;
  brandIdForPermission: string | null;
  workflowIdForContext: string | null;
  stepIdForAssignment: number | string | null;
}

function parseInviteMetadata(appMetadata: any): InviteMetadata {
  const metadata = appMetadata || {};
  // Logic to determine source, role, brandId, workflowId, stepId
  if (metadata.invite_type === 'direct_user_invite' && metadata.intended_role) {
    return {
      source: 'direct_admin',
      intendedRole: metadata.intended_role as UserRoles,
      brandIdForPermission: metadata.invited_to_brand_id || null,
      workflowIdForContext: null,
      stepIdForAssignment: null,
    };
  } else if (metadata.invite_type === 'brand_admin_invite_on_update' && metadata.intended_role && metadata.assigned_as_brand_admin_for_brand_id) {
    return {
      source: 'brand_assignment',
      intendedRole: metadata.intended_role as UserRoles,
      brandIdForPermission: metadata.assigned_as_brand_admin_for_brand_id,
      workflowIdForContext: null,
      stepIdForAssignment: null,
    };
  } else if (metadata.invited_from_workflow && metadata.role) { // Assuming 'role' is set for workflow invites
    return {
      source: 'workflow_assignment',
      intendedRole: metadata.role as UserRoles,
      brandIdForPermission: metadata.invited_to_brand_id || null, // Assuming brand context is available
      workflowIdForContext: metadata.invited_from_workflow,
      stepIdForAssignment: metadata.step_id_for_assignment || null,
    };
  }
  return { source: 'unknown', intendedRole: null, brandIdForPermission: null, workflowIdForContext: null, stepIdForAssignment: null };
}

async function assignSuperadminRole(userId: string, existingUserMetadata: any, supabase: SupabaseClient<Database>) {
  console.log(`[InviteService] Assigning Superadmin role to user ${userId}`);
  const { error } = await supabase.auth.admin.updateUserById(
    userId,
    { user_metadata: { ...existingUserMetadata, role: 'admin' } }
  );
  if (error) throw new Error(`DB_SUPERADMIN_ROLE_FAIL: ${error.message}`);
  console.log(`[InviteService] Successfully set user_metadata.role = 'admin' for Superadmin ${userId}`);
}

async function assignBrandPermissions(userId: string, brandId: string, role: UserRoles, supabase: SupabaseClient<Database>) {
  console.log(`[InviteService] Assigning role '${role}' to user ${userId} for brand ${brandId}`);
  
  // Map 'admin' (from UserRoles / global context) to 'admin' for user_brand_permissions table (temporarily, as 'brand_admin' is the target)
  // The actual role in user_brand_permissions should be 'admin', 'editor', or 'viewer' as per current DB enum
  let dbRole: Database['public']['Enums']['user_brand_role_enum'];
  if (role === 'admin') {
    dbRole = 'admin'; // Temporarily map intended 'brand_admin' or global 'admin' to 'admin' for the user_brand_permissions table
  } else if (role === 'editor') {
    dbRole = 'editor';
  } else {
    dbRole = 'viewer';
  }
  
  const { error } = await supabase
    .from('user_brand_permissions')
    .upsert({ user_id: userId, brand_id: brandId, role: dbRole }, { onConflict: 'user_id,brand_id' });
  if (error) throw new Error(`DB_BRAND_PERMISSION_FAIL: ${error.message}`);
  console.log(`[InviteService] Successfully assigned brand permission (as '${dbRole}') for user ${userId}, brand ${brandId}.`);
}

async function finalizeWorkflowUser(
    userId: string, userEmail: string, workflowId: string, 
    stepId: number | string | null, // stepId should be the UUID string now
    brandId: string, role: UserRoles, 
    supabase: SupabaseClient<Database>
) {
  console.log(`[InviteService] Finalizing workflow user ${userId} for workflow ${workflowId}, brand ${brandId}, role ${role}`);
  // 1. Assign brand permission (can be called here if not guaranteed to be called before)
  // await assignBrandPermissions(userId, brandId, role, supabase);

  // 2. Update workflow_invitations status
  const { error: updateWfInviteError } = await supabase
    .from('workflow_invitations')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('email', userEmail)
    .eq('workflow_id', workflowId)
    .eq('status', 'pending');
  if (updateWfInviteError) console.warn(`[InviteService] Failed to update workflow_invitation status: ${updateWfInviteError.message}`);
  else console.log(`[InviteService] Updated workflow_invitation status for ${userEmail}, workflow ${workflowId}`);

  // 3. Ensure workflow_user_assignments
  if (stepId !== null && typeof stepId === 'string') { // Ensure stepId is a string (UUID)
    const { error: assignError } = await supabase
      .from('workflow_user_assignments')
      .upsert({ workflow_id: workflowId, step_id: stepId, user_id: userId }, { onConflict: 'workflow_id,step_id,user_id' }); // Use stepId directly
    if (assignError) console.warn(`[InviteService] Failed to upsert workflow_user_assignment: ${assignError.message}`);
    else console.log(`[InviteService] Ensured workflow_user_assignment for user ${userId}, workflow ${workflowId}, step ${stepId}`);
  } else if (stepId !== null) {
    console.warn(`[InviteService] stepId for workflow user assignment was not a string (expected UUID): ${stepId}`);
  } else {
    console.warn(`[InviteService] No stepId provided for workflow user assignment for user ${userId}, workflow ${workflowId}.`);
  }
}

async function cleanupAppMetadata(userId: string, appMetadata: any, supabase: SupabaseClient<Database>) {
    const metadataToClear: Record<string, undefined> = {
        intended_role: undefined, invited_to_brand_id: undefined, invite_type: undefined,
        assigned_as_brand_admin_for_brand_id: undefined, invited_from_workflow: undefined, role: undefined,
        step_id_for_assignment: undefined, 
        // Add any other invite-specific keys used by your inviter functions
    };
    const newAppMetadata = { ...appMetadata };
    for (const key in metadataToClear) {
        if (newAppMetadata.hasOwnProperty(key)) { // Check if key exists before deleting
            delete newAppMetadata[key];
        }
    }
    const { error } = await supabase.auth.admin.updateUserById(userId, { app_metadata: newAppMetadata });
    if (error) console.warn(`[InviteService] Failed to cleanup app_metadata for user ${userId}: ${error.message}`);
    else console.log(`[InviteService] Cleaned up app_metadata for user ${userId}`);
}

// Main function to be called by the API route
export async function processInviteCompletion(
    user: any, // Supabase user object
    supabase: SupabaseClient<Database>
): Promise<{ success: boolean; message: string; httpStatus?: number; data?: any }> {
    const userId = user.id;
    const userEmail = user.email;
    const appMetadata = user.app_metadata || {};
    const existingUserMetadata = user.user_metadata || {};

    const parsedMeta = parseInviteMetadata(appMetadata);

    if (parsedMeta.source === 'unknown' || !parsedMeta.intendedRole) {
        console.warn(`[InviteService] Unknown invite source or missing role for user ${userId}. AppMetadata:`, appMetadata);
        // Attempt to cleanup metadata even if source is unknown to prevent stale data
        await cleanupAppMetadata(userId, appMetadata, supabase);
        return { success: true, message: 'Invite confirmed, but specific permissions could not be assigned due to missing or unclear context. Invite data cleaned.', httpStatus: 200 };
    }
    
    // Role validation using the defined UserRoles type and values from the generated types
    const validRoles: ReadonlyArray<UserRoles> = ['admin', 'editor', 'viewer']; // These are the literal types of UserRoles
    if (!validRoles.includes(parsedMeta.intendedRole)) {
        console.error(`[InviteService] Invalid role specified: ${parsedMeta.intendedRole} for user ${userId}`);
        await cleanupAppMetadata(userId, appMetadata, supabase); // Cleanup before returning error
        return { success: false, message: `Invalid role specified: ${parsedMeta.intendedRole}`, httpStatus: 400 };
    }
    
    try {
        // Ensure the global role is set in user_metadata based on the invite
        if (parsedMeta.intendedRole) {
            const updatedUserMetadata = { 
                ...existingUserMetadata, 
                role: parsedMeta.intendedRole 
            };
            const { error: roleSetError } = await supabase.auth.admin.updateUserById(
                userId,
                { user_metadata: updatedUserMetadata }
            );
            if (roleSetError) {
                console.error(`[InviteService] Failed to set global role '${parsedMeta.intendedRole}' in user_metadata for user ${userId}:`, roleSetError.message);
                // Decide if this is a critical failure. For now, log and continue, 
                // as permissions might still be assigned, but global role might be missing.
                // throw new Error(`DB_GLOBAL_ROLE_SET_FAIL: ${roleSetError.message}`); 
            }
            console.log(`[InviteService] Global role '${parsedMeta.intendedRole}' set in user_metadata for user ${userId}.`);
        }

        if (parsedMeta.source === 'direct_admin' && parsedMeta.intendedRole === 'admin' && !parsedMeta.brandIdForPermission) {
            // The general role update above already handles setting the 'admin' role.
            // assignSuperadminRole can be considered redundant if its only job is to set user_metadata.role = 'admin'.
            // If assignSuperadminRole has other side effects, it should be kept and potentially refactored.
            // For now, as it ONLY sets the role, we can comment it out or remove it if the general update is sufficient.
            // await assignSuperadminRole(userId, existingUserMetadata, supabase); 
            // No specific action needed here anymore if the role is set above.
            console.log(`[InviteService] Processing direct_admin invite for superadmin role (already handled by general role update).`);
        } else if (parsedMeta.brandIdForPermission && parsedMeta.intendedRole) {
            // This handles 'direct_admin' to a brand, 'brand_assignment', and 'workflow_assignment'
            await assignBrandPermissions(userId, parsedMeta.brandIdForPermission, parsedMeta.intendedRole, supabase);
            
            if (parsedMeta.source === 'workflow_assignment' && parsedMeta.workflowIdForContext && parsedMeta.brandIdForPermission) {
                // Ensure role for workflow context is correctly derived if it can differ from brand permission role
                const workflowContextRole = parsedMeta.intendedRole; // Assuming it's the same for now
                await finalizeWorkflowUser(userId, userEmail!, parsedMeta.workflowIdForContext, parsedMeta.stepIdForAssignment, parsedMeta.brandIdForPermission, workflowContextRole, supabase);
            }
        } else {
             console.warn(`[InviteService] Unhandled permission assignment case for user ${userId}. ParsedMeta:`, parsedMeta);
             // Cleanup metadata even for unhandled cases
             await cleanupAppMetadata(userId, appMetadata, supabase);
             return { success: true, message: 'Invite confirmed, but no specific permission assignment path was met. Invite data cleaned.', httpStatus: 200 };
        }
        
        await cleanupAppMetadata(userId, appMetadata, supabase);
        return { success: true, message: 'Invite process completed successfully. Permissions assigned.', httpStatus: 200 };

    } catch (error: any) {
        console.error(`[InviteService] Error processing invite for user ${userId}:`, error.message, error.stack);
        // Do not cleanup metadata on error, as it might be needed for reprocessing or debugging
        if (error.message?.startsWith('DB_')) {
             return { success: false, message: `Database operation failed: ${error.message}`, httpStatus: 500 };
        }
        return { success: false, message: `Failed to complete invite process: ${error.message}`, httpStatus: 500 };
    }
} 