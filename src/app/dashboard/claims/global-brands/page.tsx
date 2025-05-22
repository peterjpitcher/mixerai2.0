'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/button'; // Changed from ui/button to components/button for consistency
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Added for modal input
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from '@/components/card'; // Added for consistent layout
import { PlusCircle, Edit, Trash2, ShieldAlert, Loader2, Building, AlertTriangle, FileText, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface GlobalClaimBrand {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface UserSessionData {
    id: string;
    user_metadata?: {
        role?: string;
    };
}

// Breadcrumb components
const BreadcrumbItem = ({ href, children, isCurrent }: { href?: string, children: React.ReactNode, isCurrent?: boolean }) => (
  <li className="flex items-center">
    {href && !isCurrent ? (
      <Link href={href} className="hover:text-primary">
        {children}
      </Link>
    ) : (
      <span className={isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}>{children}</span>
    )}
    {!isCurrent && <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />}
  </li>
);

const Breadcrumbs = ({ items }: { items: Array<{ href?: string, label: string, isCurrent?: boolean }> }) => (
  <nav aria-label="Breadcrumb" className="mb-6">
    <ol className="flex items-center space-x-1 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <BreadcrumbItem key={index} href={item.href} isCurrent={item.isCurrent}>
          {item.label}
        </BreadcrumbItem>
      ))}
    </ol>
  </nav>
);

export default function GlobalClaimBrandsPage() {
  const [globalBrands, setGlobalBrands] = useState<GlobalClaimBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<GlobalClaimBrand | null>(null);
  const [brandName, setBrandName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      setIsLoadingUser(true);
      try {
        const res = await fetch('/api/me');
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
        } else {
          setError('Failed to load user data. Please refresh the page.');
          toast.error('Failed to load user data.', { description: data.error || "Could not retrieve your user session." });
        }
      } catch (e: any) {
        setError('Error fetching user data: ' + e.message);
        toast.error('Error fetching user data.', { description: e.message });
        console.error(e);
      } finally {
        setIsLoadingUser(false);
      }
    }
    fetchUser();
  }, []);

  const fetchGlobalBrands = useCallback(async () => {
    setIsLoading(true);
    setError(null); // Reset error before fetch
    try {
      const response = await fetch('/api/global-claim-brands');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch global brands' }));
        throw new Error(errorData.error || 'Server error fetching global brands');
      }
      const data = await response.json();
      if (data.success) {
        setGlobalBrands(Array.isArray(data.data) ? data.data : []);
      } else {
        throw new Error(data.error || 'Unknown error fetching global brands');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while fetching global brands.');
      toast.error('Failed to load global brands.', { description: err.message });
      setGlobalBrands([]); // Ensure it's an empty array on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch if user is loaded and is an admin
    if (!isLoadingUser && currentUser?.user_metadata?.role === 'admin') {
      fetchGlobalBrands();
    }
  }, [currentUser, isLoadingUser, fetchGlobalBrands]);

  const handleOpenAddModal = () => {
    setEditingBrand(null);
    setBrandName('');
    setShowModal(true);
  };

  const handleOpenEditModal = (brand: GlobalClaimBrand) => {
    setEditingBrand(brand);
    setBrandName(brand.name);
    setShowModal(true);
  };

  const handleSaveBrand = async () => {
    if (!brandName.trim()) {
      toast.error('Brand name cannot be empty.');
      return;
    }
    setIsSubmitting(true);
    const url = editingBrand ? `/api/global-claim-brands/${editingBrand.id}` : '/api/global-claim-brands';
    const method = editingBrand ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: brandName.trim() }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success(`Global brand ${editingBrand ? 'updated' : 'created'} successfully!`);
        setShowModal(false);
        fetchGlobalBrands();
      } else {
        toast.error(`Failed to ${editingBrand ? 'update' : 'create'} global brand.`, {
          description: result.error || 'An unknown server error occurred.',
        });
      }
    } catch (err: any) {
      toast.error('An unexpected error occurred during save.', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBrand = async (brandId: string) => {
    // Using toast for confirmation as per UI standard recommendation for non-critical deletions
    toast.warning("Are you sure you want to delete this global brand?", {
      description: "Claims using it will be unlinked. This action cannot be undone.",
      action: {
        label: "Delete",
        onClick: async () => {
          setIsSubmitting(true); // Disable other actions during delete
          try {
            const response = await fetch(`/api/global-claim-brands/${brandId}`, { method: 'DELETE' });
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Failed to delete global brand' }));
              throw new Error(errorData.error || 'Server error during deletion.');
            }
            const result = await response.json();
            if (result.success) {
              toast.success('Global brand deleted successfully.');
              fetchGlobalBrands();
            } else {
              throw new Error(result.error || 'Failed to delete global brand from server.');
            }
          } catch (err: any) {
            toast.error('Failed to delete global brand.', { description: err.message });
          } finally {
            setIsSubmitting(false);
          }
        }
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
      duration: 10000, // Keep toast longer for user to react
    });
  };
  
  const breadcrumbItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/claims/manage", label: "Claims Management" }, // Assuming a parent page for claims
    { label: "Global Claim Brands", isCurrent: true }
  ];

  if (isLoadingUser) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading user data...</p>
      </div>
    );
  }

  if (currentUser?.user_metadata?.role !== 'admin') {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <Breadcrumbs items={breadcrumbItems.map(item => item.label === "Global Claim Brands" ? {...item, isCurrent: false} : item ).slice(0, -1)} /> {/* Show parent breadcrumbs */}
        <Card className="mt-6">
          <CardContent className="py-10 flex flex-col items-center justify-center text-center">
            <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">You do not have permission to manage Global Claim Brands.</p>
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Claim Brands</h1>
          <UiCardDescription className="mt-1">
            Manage global brand entities used for brand-level claims. These are distinct from main company brands.
          </UiCardDescription>
        </div>
        <Button onClick={handleOpenAddModal} disabled={isSubmitting}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Global Brand
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered Global Claim Brands</CardTitle>
          <UiCardDescription>
            A list of all global brands available for associating with brand-level claims.
          </UiCardDescription>
        </CardHeader>
        <CardContent>
          {error && (
             <div className="mb-4 p-4 border border-destructive bg-destructive/10 rounded-md text-destructive flex items-start">
                <AlertTriangle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-semibold">Error loading data:</p>
                    <p className="text-sm">{error} Please try refreshing the page.</p>
                </div>
            </div>
          )}
          {isLoading && globalBrands.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin mb-3" />
              <p>Loading global claim brands...</p>
            </div>
          )}
          {!isLoading && !error && globalBrands.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3" />
              <p className="font-semibold">No Global Claim Brands Found</p>
              <p>Click "Add Global Brand" to create one.</p>
            </div>
          )}
          {!isLoading && globalBrands.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Created At</TableHead>
                  <TableHead className="hidden md:table-cell">Last Updated</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {globalBrands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-mono text-xs">{brand.id.substring(0, 8)}...</TableCell>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{new Date(brand.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="hidden md:table-cell">{new Date(brand.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        <Button variant="ghost" size="icon" title="Edit Brand" onClick={() => handleOpenEditModal(brand)} disabled={isSubmitting}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit {brand.name}</span>
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete Brand" onClick={() => handleDeleteBrand(brand.id)} disabled={isSubmitting} className="text-destructive hover:text-destructive/90">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {brand.name}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={(isOpen) => { if (!isSubmitting) setShowModal(isOpen); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingBrand ? 'Edit' : 'Add New'} Global Claim Brand</DialogTitle>
            <DialogDescription>
              {editingBrand ? 'Update the name of this global brand.' : 'Enter the name for the new global brand. This name must be unique.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="brandNameInput" className="text-right col-span-1">Name*</Label>
              <Input
                id="brandNameInput"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g., Certified Organic Ingredients"
                className="col-span-3"
                required
                aria-required="true"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleSaveBrand} disabled={isSubmitting || !brandName.trim()} className="min-w-[90px]">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : (editingBrand ? 'Save Changes' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 