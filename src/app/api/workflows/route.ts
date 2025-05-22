// Import the uuid package for generating unique identifiers for workflow invitations
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { handleApiError, isBuildPhase, isDatabaseConnectionError } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';
import { withAuth } from '@/lib/auth/api-auth';
import { verifyEmailTemplates } from '@/lib/auth/email-templates';

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

// Fallback data function removed as per no-fallback policy
// const getFallbackWorkflows = () => { ... };

/**
 * GET endpoint to retrieve all workflows with related data
 */
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    // Build phase fallback removed
    // if (isBuildPhase()) { ... }
    
    const supabase = createSupabaseAdminClient();
    const url = new URL(request.url);
    const requestedBrandId = url.searchParams.get('brand_id');
    const globalRole = user?.user_metadata?.role;
    let permittedBrandIds: string[] | null = null;

    if (globalRole !== 'admin') {
      // Fetch brand_permissions directly for the user
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('user_brand_permissions')
        .select('brand_id')
        .eq('user_id', user.id);

      if (permissionsError) {
        console.error('[API Workflows GET] Error fetching brand permissions for user:', user.id, permissionsError);
        return handleApiError(permissionsError, 'Failed to fetch user brand permissions');
      }

      if (!permissionsData || permissionsData.length === 0) {
        console.log('[API Workflows GET] Non-admin user has no brand permissions in user_brand_permissions table. Returning empty array.');
        return NextResponse.json({ success: true, data: [] });
      }
      
      permittedBrandIds = permissionsData.map(p => p.brand_id).filter(id => id != null);
      
      if (permittedBrandIds.length === 0) {
        console.log('[API Workflows GET] Non-admin user has no valid brand IDs after fetching permissions. Returning empty array.');
        return NextResponse.json({ success: true, data: [] });
      }
      console.log(`[API Workflows GET] User ${user.id} (role: ${globalRole}) has permitted brand IDs: ${permittedBrandIds.join(', ')}`);
    }
    
    let query = supabase
      .from('workflows')
      .select(`
        id,
        name,
        brand_id,
        created_at,
        updated_at,
        template_id,
        brands:brand_id ( name, brand_color ),
        content_templates:template_id ( name ),
        content ( count ),
        workflow_steps ( count )
      `)
      .order('created_at', { ascending: false });
    
    if (requestedBrandId) {
      if (globalRole !== 'admin' && permittedBrandIds && !permittedBrandIds.includes(requestedBrandId)) {
        console.log(`[API Workflows GET] Non-admin user access denied for requested brand_id: ${requestedBrandId}`);
        return NextResponse.json({ success: true, data: [] }); // Or return 403 error
      }
      console.log(`[API Workflows GET] Filtering by requested brand_id: ${requestedBrandId}`);
      query = query.eq('brand_id', requestedBrandId);
    } else if (globalRole !== 'admin' && permittedBrandIds) {
      // If no specific brand requested, and user is not admin, filter by their permitted brands
      console.log(`[API Workflows GET] Non-admin user. Filtering workflows by permitted brand IDs: ${permittedBrandIds.join(', ')}`);
      query = query.in('brand_id', permittedBrandIds);
    } else if (globalRole === 'admin') {
      console.log('[API Workflows GET] Admin user. Fetching all workflows (or specific brand if requestedBrandId set).');
      // Admins can see all, or specific if requestedBrandId is set (handled by the first if block)
    }
    
    const { data: workflows, error } = await query;
    
    if (error) throw error;
    
    const formattedWorkflows = workflows.map((workflow: any) => ({
      id: workflow.id,
      name: workflow.name,
      brand_id: workflow.brand_id,
      brand_name: workflow.brands?.name || null,
      brand_color: workflow.brands?.brand_color || null,
      template_id: workflow.template_id,
      template_name: workflow.content_templates?.name || null,
      steps_count: workflow.workflow_steps && workflow.workflow_steps.length > 0 ? workflow.workflow_steps[0].count : 0,
      content_count: workflow.content && workflow.content.length > 0 ? workflow.content[0].count : 0,
      created_at: workflow.created_at,
      updated_at: workflow.updated_at
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: formattedWorkflows 
    });
  } catch (error) {
    // Database connection error fallback removed
    // if (isDatabaseConnectionError(error)) { ... }
    
    // Generic error handling (console.error removed from handleApiError or here)
    return handleApiError(error, 'Error fetching workflows');
  }
});

/**
 * POST endpoint to create a new workflow
 */
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createSupabaseAdminClient();
    const body = await request.json();
    
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Workflow name is required' },
        { status: 400 }
      );
    }
    
    if (!body.brand_id) {
      return NextResponse.json(
        { success: false, error: 'Brand ID is required' },
        { status: 400 }
      );
    }

    // Permission Check:
    const isGlobalAdmin = user.user_metadata?.role === 'admin';
    let canCreateWorkflow = isGlobalAdmin;

    if (!isGlobalAdmin) {
      // If not a global admin, check if they are an admin for the specified brand_id
      const { data: brandAdminPermission, error: permError } = await supabase
        .from('user_brand_permissions')
        .select('brand_id')
        .eq('user_id', user.id)
        .eq('brand_id', body.brand_id)
        .eq('role', 'admin' as const) // Temporarily map brand_admin to admin
        .maybeSingle();

      if (permError) {
        console.error(`[API Workflows POST] Error checking brand admin permission for user ${user.id}, brand ${body.brand_id}:`, permError);
        return handleApiError(permError, 'Error checking brand permissions');
      }
      if (brandAdminPermission) {
        canCreateWorkflow = true;
      }
    }

    if (!canCreateWorkflow) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You do not have permission to create a workflow for this brand.' },
        { status: 403 }
      );
    }
    
    if (body.steps && !Array.isArray(body.steps)) {
      return NextResponse.json(
        { success: false, error: 'Steps must be an array' },
        { status: 400 }
      );
    }
    
    // workflowDescription must be declared here to be available for the update later
    let workflowDescription = '';
    const stepsForAIDescription = body.steps || []; // Use a distinct variable for AI description if body.steps is modified

    // --- AI Description Generation ---
    try {
      let brandNameForDesc;
      if (body.brand_id) {
        const { data: brandData } = await supabase
          .from('brands')
          .select('name')
          .eq('id', body.brand_id)
          .single();
        brandNameForDesc = brandData?.name;
      }

      let templateNameForDesc;
      if (body.template_id) {
        const { data: templateData } = await supabase
          .from('content_templates')
          .select('name')
          .eq('id', body.template_id)
          .single();
        templateNameForDesc = templateData?.name;
      }
      
      const stepNamesForDesc = stepsForAIDescription.map((step: any) => step.name).filter(Boolean);

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const aiDescriptionResponse = await fetch(`${baseUrl}/api/ai/generate-workflow-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowName: body.name,
          brandName: brandNameForDesc,
          templateName: templateNameForDesc,
          stepNames: stepNamesForDesc,
        }),
      });

      if (aiDescriptionResponse.ok) {
        const aiData = await aiDescriptionResponse.json();
        if (aiData.success && aiData.description) {
          workflowDescription = aiData.description;
        } else {
          console.warn('AI description generation succeeded but no description was returned or success was false.');
        }
      } else {
        const errorData = await aiDescriptionResponse.json();
        console.warn('Failed to generate AI description:', errorData.error || aiDescriptionResponse.statusText);
      }
    } catch (aiError) {
      console.warn('Error calling AI description generation service:', aiError);
    }
    // --- End AI Description Generation ---
    
    // Define the structure for items being passed to the RPC for logging invitations
    interface RpcInvitationItem {
      step_id: number;
      email: string;
      role: string; // Sanitised role
      invite_token: string;
      expires_at: string;
    }
    
    const rawSteps = body.steps || [];
    
    const processedStepsForRPC: any[] = [];
    const invitationItems: RpcInvitationItem[] = []; 
    const pendingInvites: string[] = [];

    for (const rawStep of rawSteps) {
        const stepRole = ['admin', 'editor', 'viewer'].includes(rawStep.role) ? rawStep.role : 'editor';
        const processedAssigneesForStep: any[] = [];

        let stepId = NaN;
        if (typeof rawStep.id === 'number') {
            stepId = rawStep.id;
        } else if (typeof rawStep.id === 'string' && rawStep.id.trim() !== '') {
            stepId = parseInt(rawStep.id, 10);
        } else if (rawStep.id !== null && rawStep.id !== undefined) {
            const idStr = String(rawStep.id);
            if (idStr.trim() !== '') stepId = parseInt(idStr, 10);
        }

        if (rawStep.assignees && Array.isArray(rawStep.assignees)) {
            for (const assignee of rawStep.assignees) {
                if (!assignee.email || typeof assignee.email !== 'string') {
                    console.warn('Skipping assignee due to missing or invalid email:', assignee);
                    continue; 
                }

                const { data: existingUser, error: userFetchError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', assignee.email)
                    .maybeSingle();

                if (userFetchError) {
                    console.error(`Error fetching profile for ${assignee.email}:`, userFetchError);
                    continue;
                }
                
                const processedAssignee = { ...assignee }; 
                if (existingUser) {
                    processedAssignee.id = existingUser.id;
                } else {
                    if (!isNaN(stepId)) { 
                        invitationItems.push({
                            step_id: stepId,
                            email: assignee.email,
                            role: stepRole, 
                            invite_token: uuidv4(),
                            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        });
                        if (!pendingInvites.includes(assignee.email)) {
                            pendingInvites.push(assignee.email);
                        }
                    } else {
                        console.warn(`Skipping invitation for assignee ${assignee.email} because of an invalid or unparseable stepId for step:`, rawStep);
                    }
                }
                processedAssigneesForStep.push(processedAssignee);
            }
        }

        const baseStepData = (typeof rawStep === 'object' && rawStep !== null) ? rawStep : {};
        processedStepsForRPC.push({
            ...baseStepData, 
            id: !isNaN(stepId) ? stepId : null,
            role: stepRole, 
            assignees: processedAssigneesForStep 
        });
    }
    
    const rpcParams = {
      p_name: body.name,
      p_brand_id: body.brand_id,
      p_steps_definition: processedStepsForRPC,
      p_created_by: user.id,
      p_invitation_items: invitationItems
    };

    const { data: newWorkflowId, error: rpcError } = await supabase.rpc(
      'create_workflow_and_log_invitations' as any,
      rpcParams
    );

    if (rpcError) {
      console.error('RPC Error creating workflow and logging invitations:', rpcError);
      throw new Error(`Failed to create workflow: ${rpcError.message}`);
    }

    if (!newWorkflowId) {
      throw new Error('Workflow creation failed, no ID returned from function.');
    }
    
    if (newWorkflowId) {
      const { error: updateError } = await supabase
        .from('workflows')
        .update({
          description: workflowDescription, // This requires workflowDescription to be in scope
          template_id: body.template_id || null
        })
        .eq('id', newWorkflowId);

      if (updateError) {
        console.error('Error updating workflow with description and template_id:', updateError);
      }
    }

    if (pendingInvites.length > 0) {
      try {
        await verifyEmailTemplates();
        
        for (const email of pendingInvites) {
          let highestRole: 'admin' | 'editor' | 'viewer' = 'viewer'; 
          let firstStepIdForAssignment: number | string | null = null;

          for (const item of invitationItems) { // RpcInvitationItem
            if (item.email === email) {
              if (firstStepIdForAssignment === null && typeof item.step_id === 'number') { // Ensure step_id is number
                firstStepIdForAssignment = item.step_id;
              }
              // Type assertion for item.role as it's string in RpcInvitationItem
              const currentRole = item.role as 'admin' | 'editor' | 'viewer';
              if (currentRole === 'admin') {
                highestRole = 'admin';
              } else if (currentRole === 'editor' && highestRole !== 'admin') {
                highestRole = 'editor';
              }
            }
          }
          
          const appMetadataPayload: Record<string, any> = {
            full_name: '',
            role: highestRole,
            invited_by: user.id,
            invited_from_workflow: newWorkflowId
          };

          if (firstStepIdForAssignment !== null) {
            appMetadataPayload.step_id_for_assignment = firstStepIdForAssignment;
          }
          
          const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
            data: appMetadataPayload
          });
          
          if (inviteError) {
            console.error(`Failed to send auth invite to ${email}:`, inviteError);
          }
        }
      } catch (inviteProcessError) {
        console.error('Error during the auth invite sending process:', inviteProcessError);
      }
    }
    
    const { data: createdWorkflow, error: fetchError } = await supabase
      .from('workflows')
      .select(`
        *,
        description,
        template_id,
        content_templates:template_id ( name ),
        brands:brand_id(name, brand_color)
      `)
      .eq('id', newWorkflowId)
      .single();

    if (fetchError) {
      console.error('Error fetching newly created workflow:', fetchError);
      return NextResponse.json({ 
        success: true, 
        workflow_id: newWorkflowId,
        warning: 'Workflow created, but failed to fetch full data.'
      });
    }

    const formattedWorkflow = {
      ...(createdWorkflow || {}), // Handle null createdWorkflow
      brand_name: createdWorkflow?.brands?.name || null,
      brand_color: createdWorkflow?.brands?.brand_color || null,
      description: createdWorkflow?.description || '',
      template_id: createdWorkflow?.template_id || null,
      template_name: createdWorkflow?.content_templates?.name || null,
      steps_count: Array.isArray(createdWorkflow?.steps) ? createdWorkflow.steps.length : 0,
      content_count: 0
    };
    
    return NextResponse.json({
      success: true,
      workflow: formattedWorkflow
    });
  } catch (error) {
    return handleApiError(error, 'Error creating workflow');
  }
}); 