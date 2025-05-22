'use client';

import Link from 'next/link';
import { usePathname, useSelectedLayoutSegments } from 'next/navigation';
import {
  Home,
  GitBranch,
  BookOpen,
  Building2,
  Users,
  Settings,
  HelpCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  Wrench,
  Code,
  Image,
  Globe,
  Folder,
  ListChecks,
  Loader2,
  MessageSquareWarning,
  Info,
  Package,
  Leaf,
  Eye,
  Building
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

interface UserSessionData {
  id: string;
  email?: string;
  user_metadata?: {
    role?: string;
    full_name?: string;
    // other metadata fields
  };
  brand_permissions?: Array<{
    brand_id: string;
    role: string; // role within that brand
    // other permission fields
  }>;
  // Add other fields that your session endpoint might return
}

// Define a type for spacer items
interface NavSpacer {
  type: 'divider';
  show?: () => boolean; // Optional show condition for spacers too
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  segment?: string; // Used for active state calculation with segments
  show?: () => boolean; // Added optional show condition for individual NavItems
}

interface NavGroupItem {
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
  segment?: string; // For matching the parent segment
  defaultOpen?: boolean; // Whether the group should be expanded by default
}

/**
 * Unified navigation component for MixerAI dashboard.
 * Provides sidebar navigation with collapsible sections and dynamic content template links.
 * Uses Next.js useSelectedLayoutSegments() for accurate active state tracking.
 */
export function UnifiedNavigation() {
  const pathname = usePathname() || '';
  const layoutSegments = useSelectedLayoutSegments();
  const segments = layoutSegments || [];
  
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    content: true,
    tools: true,
    feedback: false,
    'create content': true
  });

  // State for user templates
  const [userTemplates, setUserTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  
  // Flag to track if templates have been fetched already
  const templatesFetched = useRef(false);

  // Fetch current user data
  useEffect(() => {
    const fetchCurrentUser = async () => {
      setIsLoadingUser(true);
      try {
        const response = await fetch('/api/me'); 
        if (!response.ok) {
          throw new Error('Failed to fetch user session');
        }
        const data = await response.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('[UnifiedNavigation] Error fetching current user:', error);
        setCurrentUser(null);
      } finally {
        setIsLoadingUser(false);
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch templates from the API only once when the component mounts or content section is expanded
  useEffect(() => {
    const fetchTemplates = async () => {
      if (templatesFetched.current || isLoadingTemplates) return;
      setIsLoadingTemplates(true);
      templatesFetched.current = true;
      try {
        const response = await fetch('/api/content-templates');
        const data = await response.json();
        
        if (data.success && data.templates) {
          setUserTemplates(data.templates);
        } else {
          // Consider adding a toast notification for failure here
          console.error('[UnifiedNavigation] Failed to fetch templates:', data.error);
        }
      } catch (error) {
        console.error('[UnifiedNavigation] Error fetching templates:', error);
        // Consider adding a toast notification for failure here
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    // Always fetch templates when the component mounts
    fetchTemplates();
  }, [isLoadingTemplates]);

  // Automatically expand sections based on current path
  useEffect(() => {
    const newExpandedState = { ...expandedSections };
    let changed = false;
    if (pathname.includes('/content') && !expandedSections.content) {
      newExpandedState.content = true;
      changed = true;
    }
    if (pathname.includes('/tools') && !expandedSections.tools) {
      newExpandedState.tools = true;
      changed = true;
    }
    if (pathname.includes('/templates') && !expandedSections.content) {
      newExpandedState.content = true;
      changed = true;
    }
    if ((pathname.includes('/feedback') || pathname.includes('/admin/feedback-log')) && !expandedSections.feedback) {
      newExpandedState.feedback = true;
      changed = true;
    }
    if (changed) {
      setExpandedSections(newExpandedState);
    }
  }, [pathname]);

  // Toggle a section's expanded state
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Content items - use templates from database
  const contentItems = userTemplates.map(template => ({
    href: `/dashboard/content/new?template=${template.id}`,
    label: template.name,
    icon: <FileText className="h-4 w-4" />,
    segment: template.id
  }));
  
  // Define permission helper functions based on currentUser
  const userRole = currentUser?.user_metadata?.role;
  const userBrandPermissions = currentUser?.brand_permissions || [];
  const hasBrandAdminPermission = userBrandPermissions.some(bp => bp.role === 'admin');

  const isViewer = userRole === 'viewer';
  const isEditor = userRole === 'editor';
  const isAdmin = userRole === 'admin';
  const isPlatformAdmin = userRole === 'admin' && userBrandPermissions.length === 0;
  const isScopedAdmin = isAdmin && userBrandPermissions.length > 0;

  // New role definitions based on the navigation permissions matrix
  const isGlobalAdmin = userRole === 'admin';
  const isBrandAdmin_NonGlobal = userRole !== 'admin' && hasBrandAdminPermission;
  const isEditor_BrandAssigned_NonAdmin = userRole === 'editor' && !hasBrandAdminPermission;
  const isViewer_BrandAssigned_NonAdmin = userRole === 'viewer' && !hasBrandAdminPermission;

  // Simplified helper for general authenticated user access (adjust if more specific logic needed for base roles)
  const isAuthenticatedUserWithBrandAccess = currentUser != null && (isGlobalAdmin || isBrandAdmin_NonGlobal || isEditor_BrandAssigned_NonAdmin || isViewer_BrandAssigned_NonAdmin);

  // Primary nav items - base structure with 'show' conditions
  let navItemsDefinition: (NavItem | NavGroupItem | NavSpacer & { show?: boolean | (() => boolean) })[] = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: <Home className="h-5 w-5" />,
      segment: '', 
      show: () => isAuthenticatedUserWithBrandAccess
    },
    {
      href: '/dashboard/my-tasks',
      label: 'My Tasks',
      icon: <ListChecks className="h-5 w-5" />,
      segment: 'my-tasks',
      show: () => isAuthenticatedUserWithBrandAccess
    },
    {
      href: '/dashboard/content',
      label: 'All Content',
      icon: <Folder className="h-5 w-5" />,
      segment: 'content',
      show: () => isAuthenticatedUserWithBrandAccess
    },
    {
      href: '/dashboard/brands',
      label: 'Brands',
      icon: <Building2 className="h-5 w-5" />,
      segment: 'brands',
      show: () => isGlobalAdmin || isBrandAdmin_NonGlobal
    },
    {
      href: '/dashboard/workflows',
      label: 'Workflows',
      icon: <GitBranch className="h-5 w-5" />,
      segment: 'workflows',
      show: () => isGlobalAdmin || isBrandAdmin_NonGlobal
    },
    {
      href: '/dashboard/templates',
      label: 'Content Templates',
      icon: <Folder className="h-5 w-5" />, 
      segment: 'templates',
      show: () => isGlobalAdmin
    },
    {
      label: 'Claims Management',
      icon: <ListChecks className="h-5 w-5" />,
      segment: 'claims',
      defaultOpen: true,
      show: () => isGlobalAdmin || isBrandAdmin_NonGlobal || isEditor_BrandAssigned_NonAdmin,
      items: [
        {
          href: '/dashboard/claims/manage',
          label: 'Manage All Claims',
          icon: <FileText className="h-4 w-4" />,
          segment: 'manage'
        },
        {
          href: '/dashboard/claims/products',
          label: 'Products (Claims Context)',
          icon: <Package className="h-4 w-4" />,
          segment: 'products'
        },
        {
          href: '/dashboard/claims/ingredients',
          label: 'Ingredients (Claims Context)',
          icon: <Leaf className="h-4 w-4" />,
          segment: 'ingredients'
        },
        {
          href: '/dashboard/claims/preview',
          label: 'Claims Preview Tool',
          icon: <Eye className="h-4 w-4" />,
          segment: 'preview'
        },
        {
          href: '/dashboard/claims/global-brands',
          label: 'Global Brands (for Claims)',
          icon: <Building className="h-4 w-4" />,
          segment: 'global-brands',
          show: () => isGlobalAdmin
        }
      ]
    },
    {
      label: 'Create Content', 
      icon: <BookOpen className="h-5 w-5" />,
      items: contentItems, 
      segment: 'content-new', 
      defaultOpen: true,
      show: () => (isGlobalAdmin || isEditor_BrandAssigned_NonAdmin) && contentItems.length > 0
    },
    { type: 'divider' as const, show: () => (isGlobalAdmin || isEditor_BrandAssigned_NonAdmin) }, // Divider after Create Content block
    {
      label: 'Tools',
      icon: <Wrench className="h-5 w-5" />,
      segment: 'tools',
      defaultOpen: true,
      items: [
        {
          href: '/dashboard/tools/metadata-generator',
          label: 'Metadata Generator',
          icon: <Code className="h-4 w-4" />,
          segment: 'metadata-generator'
        },
        {
          href: '/dashboard/tools/alt-text-generator',
          label: 'Alt Text Generator',
          icon: <Image className="h-4 w-4" />,
          segment: 'alt-text-generator'
        },
        {
          href: '/dashboard/tools/content-transcreator',
          label: 'Content Transcreator',
          icon: <Globe className="h-4 w-4" />,
          segment: 'content-transcreator'
        },
      ],
      show: () => isGlobalAdmin || isEditor_BrandAssigned_NonAdmin
    },
    { type: 'divider' as const, show: () => (isGlobalAdmin || isEditor_BrandAssigned_NonAdmin) }, // Divider after Tools block
    {
      label: 'Feedback',
      icon: <MessageSquareWarning className="h-5 w-5" />,
      segment: 'feedback',
      defaultOpen: expandedSections.feedback,
      items: [
        {
          href: '/dashboard/feedback',
          label: 'View Feedback',
          icon: <Info className="h-4 w-4" />,
          segment: 'view' 
        },
        ...(isGlobalAdmin ? [{ 
            href: '/dashboard/admin/feedback-log',
            label: 'Feedback Log (Admin)',
            icon: <ListChecks className="h-4 w-4" />,
            segment: 'feedback-log'
        }] : [])
      ],
      show: () => isAuthenticatedUserWithBrandAccess 
    },
    { type: 'divider' as const, show: () => isAuthenticatedUserWithBrandAccess }, // Divider after Feedback block
    {
      href: '/dashboard/users',
      label: 'Users',
      icon: <Users className="h-5 w-5" />,
      segment: 'users', 
      show: () => isGlobalAdmin
    },
    {
      href: '/dashboard/account',
      label: 'Account',
      icon: <Users className="h-5 w-5" />, 
      segment: 'account',
      show: () => currentUser != null 
    },
    {
      href: '/dashboard/help',
      label: 'Help',
      icon: <HelpCircle className="h-5 w-5" />,
      segment: 'help',
      show: () => currentUser != null
    },
    /* Commented out Settings item
    {
      href: '/dashboard/admin/settings', 
      label: 'Settings',
      icon: <Settings className="h-5 w-5" />,
      segment: 'admin-settings',
      show: () => isGlobalAdmin 
    },
    */
  ];

  // Filter nav items based on roles and conditions
  const finalNavItems = navItemsDefinition.filter(item => {
    if (isLoadingUser) return false; // Don't show anything until user data is loaded
    
    // Check if the 'show' property exists and evaluate it
    if ('show' in item && item.show !== undefined) {
      if (typeof item.show === 'boolean') return item.show;
      if (typeof item.show === 'function') return item.show();
      // If it's a divider, it might not have a show function, default to true or handle based on type
      if ('type' in item && item.type === 'divider') return true; // Show dividers by default if no specific show fn
      return true; // Should not happen if types are correct, but default to show
    }
    return true; // Default to show if no 'show' condition or if it's undefined
  });
  
  // Check if a navigation item is active based on the current URL path and segments
  const isActive = (item: NavItem | NavGroupItem) => {
    // For simple nav items
    if ('href' in item) {
      // Exact match for dashboard root
      if (item.href === '/dashboard' && segments.length === 0 && pathname === '/dashboard') {
        return true;
      }
      // Check if the current path starts with the item's href, for non-root items
      // and ensure it's not just a partial match for a longer path unless it's a group segment
      if (item.segment && segments[0] === item.segment) {
         // If item.segment is 'content', active if segments[0] is 'content'
         // and potentially segments[1] for sub-routes like /content/[id] or /content/new
        if(item.segment === 'content' && segments[0] === 'content'){
            return true;
        }
        // For items like /dashboard/users, /dashboard/brands, it's a direct segment match
        if (segments.length === 1 && segments[0] === item.segment) {
            return true;
        }
         // For /dashboard/templates specifically
        if (item.segment === 'templates' && segments[0] === 'templates') {
            return true;
        }
        return false; // Fallback for basic segment check
      }
      return pathname.startsWith(item.href) && item.href !== '/dashboard';
    }
    
    // For group items, check if any child item is active
    if ('items' in item) {
      return item.items.some(subItem => 
        segments.includes(subItem.segment || '') || 
        pathname === subItem.href
      );
    }
    
    return false;
  };
  
  return (
    <div className="flex flex-col h-full">
      <nav className="bg-card w-64 p-4 h-[calc(100vh-4rem)] overflow-y-auto border-r border-border sticky top-16 hidden lg:block">
        <div className="space-y-8">
          <div className="space-y-1">
            {finalNavItems.map((item, index) => {
              if ('type' in item && item.type === 'divider') {
                // Render a visible spacer if the item is a divider
                // And ensure it's not the very first or last item to avoid leading/trailing spacers if items are filtered out
                if (index > 0 && index < finalNavItems.length -1) { 
                    // Check if previous and next items are not dividers to avoid double dividers
                    const prevItem = finalNavItems[index-1];
                    const nextItem = finalNavItems[index+1];
                    if (!('type' in prevItem && prevItem.type === 'divider') && 
                        !('type' in nextItem && nextItem.type === 'divider')) {
                          return <hr key={`divider-${index}`} className="my-3 border-border/60" />;
                    }
                }
                return null; // Don't render divider if it's at the start/end or adjacent to another
              }
              if ('items' in item) {
                return (
                  <div key={index} className="space-y-1">
                    <button 
                      onClick={() => toggleSection(item.label.toLowerCase())}
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        isActive(item)
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-primary"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        {item.icon}
                        {item.label}
                      </span>
                      {expandedSections[item.label.toLowerCase()] 
                        ? <ChevronDown className="h-4 w-4" /> 
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </button>
                    {expandedSections[item.label.toLowerCase()] && (
                      <div className="pl-4 mt-1 space-y-1">
                        {item.items.map(subItem => {
                          const isSubItemActive = isActive(subItem);

                          // Check individual show condition for sub-items
                          if (subItem.show && !subItem.show()) {
                            return null; // Do not render this sub-item if its show condition is false
                          }

                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                                isSubItemActive
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted hover:text-primary"
                              )}
                            >
                              {subItem.icon}
                              {subItem.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              if ('href' in item) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive(item)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-primary"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              }
              return null;
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

export default UnifiedNavigation; 