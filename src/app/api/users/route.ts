import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { handleApiError, isBuildPhase, isDatabaseConnectionError } from '@/lib/api-utils';
import { withAuth } from '@/lib/auth/api-auth';

// Define the shape of user profiles returned from Supabase
interface ProfileRecord {
  id: string;
  full_name: string | null;
  email?: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  user_brand_permissions?: {
    id: string;
    brand_id: string;
    role: 'admin' | 'editor' | 'viewer' | 'brand_admin';
  }[];
  job_title?: string;
  company?: string;
}

/**
 * GET endpoint to retrieve all users with profile information
 */
export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    // Role check: Only Global Admins can list all users
    if (user.user_metadata?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You do not have permission to access this resource.' },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdminClient();
    
    const { data: authUsersData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) throw authError;
    if (!authUsersData) throw new Error('Failed to fetch auth users list.');

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        *,
        user_brand_permissions:user_brand_permissions(
          id,
          brand_id,
          role
        )
      `)
      .order('created_at', { ascending: false });
    
    if (profilesError) throw profilesError;
    if (!profilesData) throw new Error('Failed to fetch profiles data.');
    
    const mergedUsers = authUsersData.users.map(authUser => {
      const profile = (profilesData as ProfileRecord[]).find(p => p.id === authUser.id);
      
      let highestRole = 'viewer';
      if (profile?.user_brand_permissions && Array.isArray(profile.user_brand_permissions) && profile.user_brand_permissions.length > 0) {
        for (const permission of profile.user_brand_permissions) {
          if (permission && permission.role === 'admin') {
            highestRole = 'admin';
            break;
          } else if (permission && permission.role === 'editor' && highestRole !== 'admin') {
            highestRole = 'editor';
          }
        }
      }
      
      // Role Determination Logic (Issue #97):
      // 1. Find the highest role ('admin' > 'editor' > 'viewer') across all the user's brand permissions.
      // 2. If the highest brand permission role is still 'viewer', check auth.user_metadata.role as a fallback.
      // 3. This provides a primary role for display but conflates brand-specific and potential global roles.
      // TODO: Conduct full role system audit - clarify if user_metadata.role represents a true global role
      //       and ensure API authorization checks the correct permission source (brand vs. global).
      if (highestRole === 'viewer' && authUser.user_metadata?.role) {
        const metadataRole = typeof authUser.user_metadata.role === 'string' ? 
          authUser.user_metadata.role.toLowerCase() : '';
        if (metadataRole === 'admin') highestRole = 'admin';
        else if (metadataRole === 'editor') highestRole = 'editor';
      }
      
      return {
        id: authUser.id,
        full_name: profile?.full_name || authUser.user_metadata?.full_name || 'Unnamed User',
        email: authUser.email,
        avatar_url: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authUser.id}`,
        job_title: profile?.job_title || authUser.user_metadata?.job_title || '',
        company: profile?.company || authUser.user_metadata?.company || '',
        role: highestRole.charAt(0).toUpperCase() + highestRole.slice(1),
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        brand_permissions: profile?.user_brand_permissions || [],
        is_current_user: authUser.id === user.id
      };
    });

    return NextResponse.json({ 
      success: true, 
      data: mergedUsers 
    });
  } catch (error: any) {
    return handleApiError(error, 'Error fetching users');
  }
}); 