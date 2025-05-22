// Import the uuid package for generating unique workflow invitation tokens
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { handleApiError } from '@/lib/api-utils'; // Added for using in catch blocks
import { verifyEmailTemplates } from '@/lib/auth/email-templates'; // Added for sending invites
import { withAuth } from '@/lib/auth/api-auth'; // Import withAuth
// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

// Define types for the workflow invitation
interface WorkflowInvitation {
  workflow_id: string;
  step_id: number;
  email: string;
  role: string;
  invite_token: string;
  expires_at: string;
  status?: string;
}

// Define types for workflow steps and assignees
interface WorkflowAssignee {
  id?: string;
  email: string;
  name?: string;
  invitation_status?: string;
}

interface WorkflowStep {
  id: number;
  name: string;
  description: string;
  role: string;
  approvalRequired?: boolean;
  assignees?: WorkflowAssignee[];
}

/**
 * GET endpoint to retrieve a specific workflow by ID
 */
export const GET = withAuth(async (
  request: NextRequest,
  user: any, // The authenticated user object from withAuth
  { params }: { params: { id: string } }
) => {
  try {
    const supabase = createSupabaseAdminClient();
    const workflowId = params.id;
    
    const { data: workflowData, error: workflowErrorData } = await supabase
      .from('workflows')
      .select(`
        *,
        brands:brand_id(name, brand_color),
        content_templates:template_id(name)
      `)
      .eq('id', workflowId)
      .single();
    
    if (workflowErrorData) {
      if (workflowErrorData.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Workflow not found' },
          { status: 404 }
        );
      }
      console.error(`Error fetching workflow ${workflowId}:`, workflowErrorData);
      throw workflowErrorData;
    }

    // Permission Check
    const isGlobalAdmin = user.user_metadata?.role === 'admin';
    if (!isGlobalAdmin) {
      if (!workflowData || !workflowData.brand_id) {
        // Should not happen if workflow was found, but as a safeguard
        console.error(`[API Workflows GET /${workflowId}] Workflow data or brand_id missing for permission check.`);
        return NextResponse.json({ success: false, error: 'Internal server error during permission check.' }, { status: 500 });
      }

      const { data: permission, error: permError } = await supabase
        .from('user_brand_permissions')
        .select('brand_id')
        .eq('user_id', user.id)
        .eq('brand_id', workflowData.brand_id)
        .maybeSingle();

      if (permError) {
        console.error(`[API Workflows GET /${workflowId}] Error checking brand permissions for user ${user.id}, brand ${workflowData.brand_id}:`, permError);
        return handleApiError(permError, 'Error checking brand permissions');
      }

      if (!permission) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You do not have permission to access this workflow\'s brand.' },
          { status: 403 }
        );
      }
    }
    // If global admin or has permission for the workflow's brand, proceed.
    
    // Fetch actual steps from workflow_steps table
    const { data: dbSteps, error: stepsError } = await supabase
      .from('workflow_steps')
      .select('id, name, description, role, approval_required, assigned_user_ids, step_order')
      .eq('workflow_id', workflowId)
      .order('step_order', { ascending: true });

    if (stepsError) {
      console.error(`Error fetching steps for workflow ${workflowId}:`, stepsError);
      throw stepsError; 
    }

    let processedSteps: any[] = [];
    if (dbSteps && dbSteps.length > 0) {
      const allUserIds = new Set<string>();
      dbSteps.forEach(step => {
        if (step.assigned_user_ids && Array.isArray(step.assigned_user_ids)) {
          step.assigned_user_ids.forEach((userId: string | null) => { // Iterate over string | null
            if (userId) allUserIds.add(userId);
          });
        }
      });

      let userProfilesMap = new Map<string, { id: string; email: string | null; full_name: string | null }>();
      if (allUserIds.size > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', Array.from(allUserIds));

        if (profilesError) {
          console.warn(`Error fetching profiles for assignees of workflow ${workflowId}:`, profilesError.message);
          // Continue, assignees might not have full names/emails populated
        } else if (profilesData) {
          profilesData.forEach(p => userProfilesMap.set(p.id, {id: p.id, email: p.email, full_name: p.full_name}));
        }
      }

      processedSteps = dbSteps.map(step => {
        let currentStepAssignees: WorkflowAssignee[] = [];
        if (step.assigned_user_ids && Array.isArray(step.assigned_user_ids)) {
          currentStepAssignees = step.assigned_user_ids.map((userId: string | null) => { // Iterate over string | null
            if (!userId) return null; // Skip null user IDs
            const profile = userProfilesMap.get(userId);
            return {
              id: userId,
              email: profile?.email || 'N/A', // Provide a fallback
              name: profile?.full_name || 'N/A'  // Provide a fallback
            };
          }).filter(assignee => assignee !== null) as WorkflowAssignee[]; // Filter out any nulls from skipped user IDs
        }
        return {
          id: step.id, // This is workflow_steps.id (the step's own UUID)
          name: step.name,
          description: step.description,
          role: step.role,
          approvalRequired: step.approval_required,
          assignees: currentStepAssignees,
          step_order: step.step_order 
          // The frontend step object might not use step_order directly if relying on array index,
          // but good to have it if backend mutations need it.
        };
      });
    }
    
    const formattedWorkflow = {
      id: workflowData.id,
      name: workflowData.name,
      description: (workflowData as any).description || null, // Cast to any for these potentially untyped fields
      brand_id: workflowData.brand_id,
      brand_name: workflowData.brands?.name || null,
      brand_color: workflowData.brands?.brand_color || null,
      template_id: (workflowData as any).template_id || null, 
      status: (workflowData as any).status || null, 
      steps: processedSteps, 
      steps_count: processedSteps.length,
      template_name: workflowData.content_templates?.name || null,
      created_at: workflowData.created_at,
      updated_at: workflowData.updated_at,
      created_by: (workflowData as any).created_by || null 
    };

    return NextResponse.json({ 
      success: true, 
      workflow: formattedWorkflow 
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch workflow');
  }
});

/**
 * PUT endpoint to update a specific workflow
 */
export const PUT = withAuth(async (
  request: NextRequest,
  user: any, // The authenticated user object from withAuth
  { params }: { params: { id: string } }
) => {
  try {
    const supabase = createSupabaseAdminClient();
    const workflowId = params.id;
    const body = await request.json();

    // Permission Check
    const isGlobalAdmin = user.user_metadata?.role === 'admin';
    if (!isGlobalAdmin) {
      // If not global admin, fetch workflow to get its brand_id for permission check
      const { data: workflowForPermCheck, error: fetchPermError } = await supabase
        .from('workflows')
        .select('brand_id')
        .eq('id', workflowId)
        .single();

      if (fetchPermError || !workflowForPermCheck) {
        console.error(`[API Workflows PUT /${workflowId}] Error fetching workflow for permission check or workflow not found:`, fetchPermError);
        return NextResponse.json({ success: false, error: 'Workflow not found or error fetching for permissions.' }, { status: 404 });
      }

      // If workflow has no brand_id, non-global admin cannot edit (no brand to check perm for)
      if (!workflowForPermCheck.brand_id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Workflow not associated with a brand cannot be edited by non-global admin.' },
          { status: 403 }
        );
      }

      const { data: brandAdminPermission, error: permError } = await supabase
        .from('user_brand_permissions')
        .select('brand_id')
        .eq('user_id', user.id)
        .eq('brand_id', workflowForPermCheck.brand_id) // Now brand_id is guaranteed to be non-null
        .eq('role', 'admin' as const) // Temporarily map brand_admin to admin
        .maybeSingle();

      if (permError) {
        console.error(`[API Workflows PUT /${workflowId}] Error checking brand admin permission:`, permError);
        return handleApiError(permError, 'Error checking brand permissions');
      }

      if (!brandAdminPermission) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You do not have admin permission for this workflow\'s brand to update it.' },
          { status: 403 }
        );
      }
    }
    // If global admin or brand admin for this workflow's brand, proceed.
    
    let workflowDescriptionToUpdate: string | undefined = undefined;

    // --- AI Description Generation on Update (if relevant fields change) ---
    // We only regenerate the description if name, brand_id, template_id, or steps are changing,
    // as these are the inputs to the description generation.
    const shouldRegenerateDescription = body.name !== undefined || 
                                    body.brand_id !== undefined || 
                                    body.template_id !== undefined || 
                                    body.steps !== undefined;

    if (shouldRegenerateDescription) {
      try {
        // Fetch current workflow details to get all necessary data for description generation
        const { data: currentWorkflowData, error: fetchError } = await supabase
          .from('workflows')
          .select('name, brand_id, template_id, steps, brands:brand_id(name), content_templates:template_id(name)')
          .eq('id', workflowId)
          .single();

        if (fetchError) {
          console.warn('Could not fetch current workflow data for AI description regeneration:', fetchError.message);
        } else if (currentWorkflowData) {
          const wfName = body.name || currentWorkflowData.name;
          const brandIdForDesc = body.brand_id || currentWorkflowData.brand_id;
          const templateIdForDesc = body.template_id !== undefined ? body.template_id : currentWorkflowData.template_id;
          const stepsForDesc = body.steps || currentWorkflowData.steps || [];

          let brandNameForDesc = currentWorkflowData.brands?.name;
          if (body.brand_id && body.brand_id !== currentWorkflowData.brand_id) {
            const { data: brandData } = await supabase.from('brands').select('name').eq('id', body.brand_id).single();
            brandNameForDesc = brandData?.name;
          }

          let resolvedTemplateNameForDesc: string | null | undefined = currentWorkflowData.content_templates?.name;
          if (body.template_id !== undefined && body.template_id !== currentWorkflowData.template_id) {
             if (body.template_id === null) { // template is being removed
                resolvedTemplateNameForDesc = null;
             } else {
                const { data: templateData } = await supabase.from('content_templates').select('name').eq('id', body.template_id).single();
                resolvedTemplateNameForDesc = templateData?.name;
             }
          }

          const stepNamesForDesc = (Array.isArray(stepsForDesc) ? stepsForDesc.map((step: any) => step.name) : []).filter(Boolean);
          
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const aiDescriptionResponse = await fetch(`${baseUrl}/api/ai/generate-workflow-description`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workflowName: wfName,
              brandName: brandNameForDesc,
              templateName: resolvedTemplateNameForDesc,
              stepNames: stepNamesForDesc,
            }),
          });

          if (aiDescriptionResponse.ok) {
            const aiData = await aiDescriptionResponse.json();
            if (aiData.success && aiData.description) {
              workflowDescriptionToUpdate = aiData.description;
            }
          } else {
            console.warn('Failed to regenerate AI description on update.');
          }
        }
      } catch (aiError) {
        console.warn('Error calling AI description regeneration service during update:', aiError);
      }
    }
    // --- End AI Description Generation ---

    if (body.steps && !Array.isArray(body.steps)) {
      return NextResponse.json(
        { success: false, error: 'Steps must be an array' },
        { status: 400 }
      );
    }
    
    const stepsFromClient = body.steps || [];
    const processedStepsForRpc: any[] = [];

    for (const step of stepsFromClient) {
      const validAssigneesForStep: { id: string; email?: string; name?: string }[] = [];
      if (step.assignees && Array.isArray(step.assignees)) {
        for (const assignee of step.assignees) {
          let userIdToAssign: string | null = null;

          if (assignee.id && !assignee.id.startsWith('temp-')) {
            // Assume it's a valid existing UUID if not starting with temp-
            userIdToAssign = assignee.id;
          } else if (assignee.email) {
            // ID is temporary or missing, try to find user by email
            const normalizedEmail = assignee.email.trim().toLowerCase(); // Normalize email
            console.log(`Attempting to find user by normalized email: '${normalizedEmail}' (original: '${assignee.email}') for step '${step.name}'`);
            const { data: existingUser } = await supabase
              .from('profiles') 
              .select('id')
              .eq('email', normalizedEmail) // Use normalized email for lookup
              .maybeSingle();
            
            if (existingUser) {
              userIdToAssign = existingUser.id;
            } else {
              console.warn(`Assignee with email ${assignee.email} not found for step '${step.name}'. Skipping, as auto-invitation is disabled.`);
            }
          } else {
            console.warn('Skipping assignee without a valid ID or email for step:', step.name, assignee);
          }

          if (userIdToAssign) {
            validAssigneesForStep.push({ 
              id: userIdToAssign,
              // Include email/name if available, though RPC might only need ID
              email: assignee.email,
              name: assignee.name 
            });
          }
        }
      }
      processedStepsForRpc.push({
        id: step.id, // This is the step's own UUID (primary key of workflow_steps)
        name: step.name,
        description: step.description,
        role: step.role,
        approvalRequired: step.approvalRequired,
        // IMPORTANT: Ensure the RPC 'p_steps' expects assignees as an array of UUID strings.
        // This change makes it an array of strings: ['uuid1', 'uuid2']
        assignees: validAssigneesForStep.map(a => a.id), 
        step_order: step.step_order
      });
    }

    // Since we are not inviting new users, p_new_invitation_items is always null
    const newInvitationItemsForRpc = null;

    const paramsToPass = {
      p_workflow_id: workflowId,
      p_name: body.name,
      p_brand_id: body.brand_id,
      p_steps: processedStepsForRpc, // Use the processed steps with resolved assignee IDs
      p_template_id: body.template_id !== undefined ? body.template_id : null, 
      p_description: body.description ?? workflowDescriptionToUpdate ?? null,
      p_new_invitation_items: newInvitationItemsForRpc // This will be null
    };

    console.log('Calling RPC update_workflow_and_handle_invites with params:', JSON.stringify(paramsToPass, null, 2));

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'update_workflow_and_handle_invites',
      paramsToPass
    );

    if (rpcError) {
      console.error('RPC Error updating workflow and invitations:', rpcError);
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to update workflow: ${rpcError.message} Hint: ${rpcError.hint}`,
          details: rpcError
        },
        { status: 500 }
      );
    }

    const { data: finalWorkflowData, error: finalFetchError } = await supabase
      .from('workflows')
      .select(`
        *,
        description,
        brands!inner(name, brand_color),
        content_templates!left(name)
      `)
      .eq('id', workflowId)
      .single();

    if (finalFetchError) {
        return handleApiError(finalFetchError, 'Failed to refetch workflow after update, but update may have succeeded');
    }
    
    return NextResponse.json({ 
      success: true, 
      workflow: finalWorkflowData 
    });

  } catch (error: any) {
    // General error catching for unexpected issues before or after RPC
    console.error('General error in PUT /api/workflows/[id]:', error);
    return handleApiError(error, 'Error updating workflow');
  }
});

/**
 * DELETE endpoint to remove a specific workflow
 */
export const DELETE = withAuth(async (
  request: NextRequest,
  user: any, // The authenticated user object from withAuth
  { params }: { params: { id: string } }
) => {
  try {
    const supabase = createSupabaseAdminClient();
    const workflowId = params.id;

    // Permission Check for DELETE
    const isGlobalAdminDelete = user.user_metadata?.role === 'admin';
    if (!isGlobalAdminDelete) {
      const { data: workflowForPermCheck, error: fetchPermError } = await supabase
        .from('workflows')
        .select('brand_id')
        .eq('id', workflowId)
        .single();

      if (fetchPermError || !workflowForPermCheck) {
        console.error(`[API Workflows DELETE /${workflowId}] Error fetching workflow for permission check or workflow not found:`, fetchPermError);
        return NextResponse.json({ success: false, error: 'Workflow not found or error fetching for permissions.' }, { status: 404 });
      }

      if (!workflowForPermCheck.brand_id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Workflow not associated with a brand cannot be deleted by non-global admin.' },
          { status: 403 }
        );
      }

      const { data: brandAdminPermission, error: permError } = await supabase
        .from('user_brand_permissions')
        .select('brand_id')
        .eq('user_id', user.id)
        .eq('brand_id', workflowForPermCheck.brand_id)
        .eq('role', 'admin' as const) // Temporarily map brand_admin to admin
        .maybeSingle();

      if (permError) {
        console.error(`[API Workflows DELETE /${workflowId}] Error checking brand admin permission:`, permError);
        return handleApiError(permError, 'Error checking brand permissions');
      }

      if (!brandAdminPermission) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You do not have admin permission for this workflow\'s brand to delete it.' },
          { status: 403 }
        );
      }
    }
    // If we reach here, user is a Global Admin or Brand Admin for this workflow's brand
    
    const { data: contentCountResult, error: countError } = await supabase
      .from('content')
      .select('id', { count: 'exact' })
      .eq('workflow_id', workflowId); // Corrected from id to workflowId
      
    if (countError) throw countError;
    
    // contentCountResult is an array, so check its length
    if (contentCountResult && contentCountResult.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete workflow that has associated content' 
        },
        { status: 409 }
      );
    }
    
    // Deleting associated workflow invitations is handled automatically by 
    // ON DELETE CASCADE constraint defined in the database schema.
    // await supabase
    //   .from('workflow_invitations')
    //   .delete()
    //   .eq('workflow_id', id);
    
    // Delete the workflow itself (cascade will handle invitations)
    const { error: deleteErrorData, count } = await supabase
      .from('workflows')
      .delete()
      .eq('id', workflowId) // Corrected from id to workflowId
      .select(); 
    
    if (deleteErrorData) throw deleteErrorData;
    
    if (count === 0) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Workflow deleted successfully' 
    });
  } catch (error) {
    return handleApiError(error, 'Error deleting workflow');
  }
}); 