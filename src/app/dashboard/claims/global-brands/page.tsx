'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button'; // Assuming shadcn button
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, ShieldAlert, Loader2, Building } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link'; // For breadcrumbs or other links if needed

interface GlobalClaimBrand {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface UserSessionData { // Simplified for this page context
    id: string;
    user_metadata?: {
        role?: string;
    };
}

export default function GlobalClaimBrandsPage() {
  const [globalBrands, setGlobalBrands] = useState<GlobalClaimBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Modal state
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
          setError('Failed to load user data.');
        }
      } catch (e) {
        setError('Error fetching user data.');
        console.error(e);
      } finally {
        setIsLoadingUser(false);
      }
    }
    fetchUser();
  }, []);

  const fetchGlobalBrands = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/global-claim-brands');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch global brands' }));
        throw new Error(errorData.error || 'Server error');
      }
      const data = await response.json();
      if (data.success) {
        setGlobalBrands(data.data || []);
      } else {
        throw new Error(data.error || 'Unknown error fetching global brands');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      toast.error('Failed to load global brands.', { description: err.message });
      setGlobalBrands([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.user_metadata?.role === 'admin') {
      fetchGlobalBrands();
    }
  }, [currentUser, fetchGlobalBrands]);

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
        fetchGlobalBrands(); // Refresh list
      } else {
        toast.error(`Failed to ${editingBrand ? 'update' : 'create'} global brand.`, {
          description: result.error || 'An unknown error occurred.',
        });
      }
    } catch (err: any) {
      toast.error('An unexpected error occurred.', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBrand = async (brandId: string) => {
    if (!confirm('Are you sure you want to delete this global brand? Claims using it will be unlinked.')) {
      return;
    }
    toast.info('Attempting to delete global brand...');
    try {
      const response = await fetch(`/api/global-claim-brands/${brandId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete' }));
        throw new Error(errorData.error || 'Server error');
      }
      const result = await response.json();
      if (result.success) {
        toast.success('Global brand deleted successfully.');
        fetchGlobalBrands(); // Refresh list
      } else {
        throw new Error(result.error || 'Failed to delete global brand.');
      }
    } catch (err: any) {
      toast.error('Failed to delete global brand.', { description: err.message });
    }
  };
  
  if (isLoadingUser || (isLoading && !globalBrands.length)) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-12 w-12 animate-pulse text-muted-foreground" />
            <p className="ml-4 text-muted-foreground">Loading data...</p>
        </div>
    );
  }

  if (currentUser?.user_metadata?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-4 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">You do not have permission to manage Global Claim Brands.</p>
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Global Claim Brands</h1>
          <p className="text-muted-foreground">
            Manage global brand entities used for brand-level claims.
          </p>
        </div>
        <Button onClick={handleOpenAddModal}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Global Brand
        </Button>
      </div>

      {error && !isLoading && <p className="text-destructive">Error: {error}. Displaying cached or partial data.</p>}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]"><Building className="inline mr-1 h-4 w-4" />ID (Short)</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {globalBrands.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No global claim brands found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
            {globalBrands.map((brand) => (
              <TableRow key={brand.id}>
                <TableCell className="font-mono text-xs">{brand.id.substring(0, 8)}...</TableCell>
                <TableCell className="font-medium">{brand.name}</TableCell>
                <TableCell>{new Date(brand.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(brand.updated_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" title="Edit Brand" onClick={() => handleOpenEditModal(brand)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Delete Brand" onClick={() => handleDeleteBrand(brand.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {isLoading && globalBrands.length > 0 && 
            <div className="flex items-center justify-center p-4 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading more...
            </div>
        }
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBrand ? 'Edit' : 'Add New'} Global Claim Brand</DialogTitle>
            <DialogDescription>
              {editingBrand ? 'Update the name of this global brand.' : 'Enter the name for the new global brand.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              id="brandName"
              placeholder="Brand Name (e.g., Häagen-Dazs)"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="col-span-3"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSaveBrand} disabled={isSubmitting || !brandName.trim()}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingBrand ? 'Save Changes' : 'Create Brand'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 