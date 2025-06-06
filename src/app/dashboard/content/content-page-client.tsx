'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/card';
import { Input } from '@/components/input';
import { toast as sonnerToast } from "sonner";
import { format as formatDateFns } from 'date-fns';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useSearchParams } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/accordion";
import { createBrowserClient } from '@supabase/ssr';

// Added imports for PageHeader and lucide-react icons
import { PageHeader } from "@/components/dashboard/page-header";
import { BrandIcon, BrandIconProps } from '@/components/brand-icon'; 
import { FileText, AlertTriangle, PlusCircle, Edit3, RefreshCw, CheckCircle, XCircle, ListFilter, Archive, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from "@/components/alert-dialog";

// Define types
type ContentFilterStatus = 'active' | 'approved' | 'rejected' | 'all';

interface ContentItem {
  id: string;
  title: string;
  brand_id: string;
  brand_name: string | null;
  brand_color?: string | null;
  brand_avatar_url?: string | null; // Retain for data structure, though BrandIcon doesn't use it yet
  status: string;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  creator_avatar_url?: string | null;
  template_id?: string | null;
  template_name?: string | null;
  template_icon?: string | null;
  workflow_id?: string | null;
  current_step_id?: string | null;
  current_step_name?: string | null;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  assigned_to_avatar_url?: string | null; // Added for assignee avatar
  assigned_to?: string[] | null;
}

// Define UserSessionData interface (mirroring what /api/me is expected to return)
interface UserSessionData {
  id: string;
  email?: string;
  user_metadata?: {
    role?: string; 
    full_name?: string;
    avatar_url?: string;
  };
  brand_permissions?: Array<{
    brand_id: string;
    role: string; 
  }>;
  avatar_url?: string; 
  full_name?: string; 
}

// Placeholder Breadcrumbs component
const Breadcrumbs = ({ items }: { items: { label: string, href?: string }[] }) => (
  <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
    <ol className="flex items-center space-x-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex items-center">
          {item.href ? (
            <Link href={item.href} className="hover:underline">
              {item.label}
            </Link>
          ) : (
            <span>{item.label}</span>
          )}
          {index < items.length - 1 && <span className="mx-1.5">/</span>}
        </li>
      ))}
    </ol>
  </nav>
);

export default function ContentPageClient() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [statusFilter, setStatusFilter] = useState<ContentFilterStatus>('active');
  const searchParams = useSearchParams();
  const brandIdFromParams = searchParams?.get('brandId');
  const [activeBrandData, setActiveBrandData] = useState<any>(null); 
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  // State for delete confirmation
  const [itemToDelete, setItemToDelete] = useState<ContentItem | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  useEffect(() => {
    const fetchCurrentUser = async () => {
      setIsLoadingUser(true);
      setUserError(null);
      try {
        const response = await fetch('/api/me');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch user session' }));
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
          setUserError(data.error || 'User data not found in session.');
          sonnerToast.error(data.error || 'Could not verify your session.');
        }
      } catch (error: any) {
        console.error('[ContentPageClient] Error fetching current user:', error);
        setCurrentUser(null);
        setUserError(error.message || 'An unexpected error occurred while fetching user data.');
        sonnerToast.error('Error fetching user data: ' + (error.message || 'Please try again.'));
      } finally {
        setIsLoadingUser(false);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    async function fetchContentData() {
      setIsLoading(true);
      try {
        let apiUrl = '/api/content';
        const params = new URLSearchParams();

        if (debouncedSearchQuery) {
          params.append('query', debouncedSearchQuery);
        }
        if (brandIdFromParams) {
          params.append('brandId', brandIdFromParams);
        }
        if (statusFilter) {
          params.append('status', statusFilter);
        }

        const queryString = params.toString();
        if (queryString) {
          apiUrl += `?${queryString}`;
        }
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Failed to fetch content data from API');
        const data = await response.json();
        if (data.success) {
          setContent(data.data.map((item: any) => ({ ...item, assigned_to: item.assigned_to || null })) || []);
        } else {
          setContent([]);
          throw new Error(data.error || 'API returned error fetching content');
        }
      } catch (err) {
        console.error('Error in fetchContentData:', err);
        setError((err as Error).message || 'Failed to load content data');
        setContent([]);
        sonnerToast.error("Failed to load content", { description: (err as Error).message || "Please try again." });
      } finally {
        setIsLoading(false);
      }
    }
    fetchContentData();
  }, [debouncedSearchQuery, brandIdFromParams, statusFilter, supabase]);

  useEffect(() => {
    const fetchActiveBrand = async () => {
      if (brandIdFromParams) {
        try {
          const res = await fetch(`/api/brands/${brandIdFromParams}`);
          const data = await res.json();
          if (data.success && data.brand) {
            setActiveBrandData(data.brand);
          } else {
            setActiveBrandData(null); 
            console.warn("Could not fetch active brand data for header");
          }
        } catch (err) {
          setActiveBrandData(null);
          console.warn("Error fetching active brand data:", err);
        }
      } else {
        setActiveBrandData(null); 
      }
    };
    fetchActiveBrand();
  }, [brandIdFromParams]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try { 
      return formatDateFns(new Date(dateString), 'dd MMMM yyyy'); 
    }
    catch (e) { console.error('Error formatting date:', dateString, e); return 'Invalid Date'; }
  };

  const groupedContent = useMemo(() => {
    if (!content) return {};
    return content.reduce((acc, item) => {
      const brandName = item.brand_name || 'Unassigned Brand';
      if (!acc[brandName]) acc[brandName] = [];
      acc[brandName].push(item);
      return acc;
    }, {} as Record<string, ContentItem[]>);
  }, [content]);

  const isUserAssigned = (item: ContentItem, userId: string | undefined): boolean => {
    if (!userId || !item.assigned_to) return false;
    const currentUserIdStr = String(userId);
    if (Array.isArray(item.assigned_to)) {
      return item.assigned_to.map(String).includes(currentUserIdStr);
    }
    return String(item.assigned_to_id) === currentUserIdStr;
  };

  // Permission check for deleting content
  const canDeleteContent = (item: ContentItem): boolean => {
    if (!currentUser) return false;
    if (currentUser.user_metadata?.role === 'admin') {
      return true; // Global Admins can delete
    }
    if (currentUser.brand_permissions && item.brand_id) {
      const brandPerm = currentUser.brand_permissions.find(p => p.brand_id === item.brand_id);
      if (brandPerm && brandPerm.role === 'admin') {
        return true; // Brand Admins for this content's brand can delete
      }
    }
    return false;
  };

  const handleDeleteClick = (item: ContentItem) => {
    if (!canDeleteContent(item)) {
      sonnerToast.error("You don't have permission to delete this content item.");
      return;
    }
    setItemToDelete(item);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !canDeleteContent(itemToDelete)) {
      sonnerToast.error("Deletion not allowed or item not specified.");
      setShowDeleteDialog(false);
      return;
    }
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/content/${itemToDelete.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (response.ok && result.success) {
        sonnerToast.success(`Content "${itemToDelete.title}" deleted successfully.`);
        setContent(prev => prev.filter(c => c.id !== itemToDelete.id));
      } else {
        sonnerToast.error(result.error || 'Failed to delete content.');
      }
    } catch (err: any) {
      sonnerToast.error('An error occurred during deletion: ' + err.message);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setItemToDelete(null);
    }
  };

  const EmptyState = () => ( 
      <div className="text-center py-12 px-4">
        <div className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <FileText size={40} className="text-primary" strokeWidth={1.5}/>
        </div>
        <h3 className="text-xl font-semibold mb-2">No content found</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          No content matches the current filters. Try adjusting your search or filter selection.
        </p>
        {statusFilter !== 'all' && (
          <Button variant="outline" onClick={() => setStatusFilter('all') }>
            <ListFilter size={16} className="mr-2" /> Show All Content
          </Button>
        )}
      </div>
  );
  const ErrorState = () => ( 
      <div className="text-center py-12 px-4">
        <div className="mx-auto w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <AlertTriangle size={40} className="text-destructive" strokeWidth={1.5}/>
        </div>
        <h3 className="text-xl font-semibold mb-2">Failed to load content</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">{error || "An error occurred while loading your content. Please try again."}</p>
        <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
          <RefreshCw size={16} className="mr-2" /> Retry
        </Button>
      </div>
  );

  const filterOptions: { label: string; value: ContentFilterStatus; icon?: React.ElementType }[] = [
    { label: 'Active', value: 'active', icon: ListFilter },
    { label: 'Approved', value: 'approved', icon: CheckCircle },
    { label: 'Rejected', value: 'rejected', icon: XCircle },
    { label: 'All', value: 'all', icon: Archive },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <Breadcrumbs items={[
        { label: "Dashboard", href: "/dashboard" }, 
        ...(brandIdFromParams && activeBrandData ? 
          [
            { label: "Brands", href: "/dashboard/brands" }, 
            { label: activeBrandData.name || "Brand", href: `/dashboard/brands/${brandIdFromParams}` },
            { label: "Content" }
          ] : 
          [{ label: "Content" }])
      ]} />

      <PageHeader
        title={brandIdFromParams && activeBrandData ? `Content for ${activeBrandData.name}` : "All Content"}
        description="View, manage, and track all content items across your brands."
        actions={
          <Button asChild>
            <Link href="/dashboard/templates">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Content
            </Link>
          </Button>
        }
      />
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="max-w-sm w-full sm:w-auto"><Input placeholder="Search content..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
        <div className="flex items-center space-x-2">
          {filterOptions.map(option => (
            <Button 
              key={option.value} 
              variant={statusFilter === option.value ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatusFilter(option.value)}
              className="flex items-center"
            >
              {option.icon && <option.icon className="mr-2 h-4 w-4" />}
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="py-10 flex justify-center items-center min-h-[300px]"><div className="flex flex-col items-center"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-muted-foreground">Loading content...</p></div></div>
      ) : error ? (
        <ErrorState />
      ) : Object.keys(groupedContent).length === 0 ? (
        <EmptyState />
      ) : (
        <Accordion type="multiple" defaultValue={Object.keys(groupedContent)} className="w-full space-y-4">
          {Object.entries(groupedContent).map(([brandName, items]) => (
            <AccordionItem value={brandName} key={brandName} className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="bg-muted hover:bg-muted/90 px-4 py-3">
                <div className="flex items-center">
                  {items.length > 0 && 
                    <BrandIcon 
                      name={brandName} 
                      color={items[0].brand_color ?? undefined} 
                      size="sm" 
                      className="mr-2" 
                    />}
                  <span className="font-semibold text-lg">{brandName} ({items.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50"><tr className="border-b">
                      <th className="text-left p-3 font-medium">Title</th>
                      <th className="text-left p-3 font-medium">Current Step</th>
                      <th className="text-left p-3 font-medium">Assigned To</th>
                      <th className="text-left p-3 font-medium">Created By</th>
                      <th className="text-left p-3 font-medium">Last Updated</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr></thead>
                    <tbody>
                      {items.map((item) => {
                        // --- Start Diagnostic Logging for Avatar URLs ---
                        if (process.env.NODE_ENV === 'development') {
                          console.log(`[Content List Avatar Debug] Item ID: ${item.id}, Title: ${item.title}`);
                          console.log(`  \_ Creator Name: ${item.created_by_name}, Creator Avatar URL: ${item.creator_avatar_url}`);
                          console.log(`  \_ Assignee Name: ${item.assigned_to_name}, Assignee Avatar URL: ${item.assigned_to_avatar_url}`);
                        }
                        // --- End Diagnostic Logging ---
                        return (
                          <tr key={item.id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="p-3">
                              <Link href={`/dashboard/content/${item.id}`} className="font-medium hover:underline text-primary">
                                {item.title || 'Untitled Content'}
                              </Link>
                              {item.template_name && <p className="text-xs text-muted-foreground flex items-center mt-1">
                                  {item.template_icon && <FileText className="mr-1 h-3 w-3 text-muted-foreground" />} 
                                  {item.template_name}
                              </p>}
                            </td>
                            <td className="p-3">{item.current_step_name || 'N/A'}</td>
                            <td className="p-3">
                              {item.assigned_to_name ? (
                                <div className="flex items-center">
                                  <div className="relative h-6 w-6 rounded-full bg-muted overflow-hidden flex-shrink-0 mr-2">
                                    {item.assigned_to_avatar_url ? (
                                      <img
                                        src={item.assigned_to_avatar_url}
                                        alt={item.assigned_to_name}
                                        className="object-cover w-full h-full"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                                      />
                                    ) : null}
                                    <div className={`flex items-center justify-center h-full w-full text-xs font-semibold text-primary bg-muted-foreground/20 ${item.assigned_to_avatar_url ? 'hidden' : ''}`}>
                                      {(item.assigned_to_name || 'A').charAt(0).toUpperCase()}
                                    </div>
                                  </div>
                                  <span className="truncate" title={item.assigned_to_name}>{item.assigned_to_name}</span>
                                </div>
                              ) : (
                                'N/A'
                              )}
                            </td>
                            <td className="p-3">
                              {item.created_by_name ? (
                                <div className="flex items-center">
                                  <div className="relative h-6 w-6 rounded-full bg-muted overflow-hidden flex-shrink-0 mr-2">
                                    {item.creator_avatar_url ? (
                                      <img
                                        src={item.creator_avatar_url}
                                        alt={item.created_by_name}
                                        className="object-cover w-full h-full"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                                      />
                                    ) : null}
                                    <div className={`flex items-center justify-center h-full w-full text-xs font-semibold text-primary bg-muted-foreground/20 ${item.creator_avatar_url ? 'hidden' : ''}`}>
                                      {(item.created_by_name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                  </div>
                                  <span className="truncate" title={item.created_by_name}>{item.created_by_name}</span>
                                </div>
                              ) : (
                                'N/A'
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">{formatDate(item.updated_at)}</td>
                            <td className="p-3 text-right space-x-2 whitespace-nowrap">
                              {(currentUser && isUserAssigned(item, currentUser.id)) && (
                                <Button variant="outline" size="sm" asChild className="h-8 px-2.5 text-xs">
                                    <Link href={`/dashboard/content/${item.id}/edit`}> 
                                        <Edit3 className="h-3.5 w-3.5 mr-1.5"/> Edit
                                    </Link>
                                </Button>
                              )}
                              {canDeleteContent(item) && (
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  className="h-8 px-2.5 text-xs"
                                  onClick={() => handleDeleteClick(item)}
                                  disabled={isDeleting && itemToDelete?.id === item.id}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                  {isDeleting && itemToDelete?.id === item.id ? 'Deleting...' : 'Delete'}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Delete Confirmation Dialog */}
      {itemToDelete && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Content: "{itemToDelete.title}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this content item? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}