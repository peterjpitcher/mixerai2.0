"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
import Link from 'next/link'; // Added for Breadcrumbs
import { Button } from "@/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from "@/components/card"; // Added UiCardDescription
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Edit, Trash2, AlertTriangle, Search, Leaf, Loader2, FileText, ChevronRight } from "lucide-react"; // Replaced PackageOpen with Leaf, FileText added
import { toast } from "sonner";

interface Ingredient {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string; // Assuming this exists or will be added by API
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

export default function ClaimsIngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingredientName, setIngredientName] = useState("");
  const [ingredientDescription, setIngredientDescription] = useState("");
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  const fetchIngredients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ingredients");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to fetch ingredients" }));
        throw new Error(errorData.error || "Server error fetching ingredients");
      }
      const data = await response.json();
      if (data.success) {
        setIngredients(Array.isArray(data.data) ? data.data : []);
      } else {
        throw new Error(data.error || "Unknown error fetching ingredients");
      }
    } catch (err: any) {
      console.error("Error fetching ingredients:", err);
      setError(err.message || "An unexpected error occurred while fetching ingredients.");
      toast.error("Failed to load ingredients.", { description: err.message });
      setIngredients([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const filteredIngredients = ingredients.filter((ingredient) =>
    ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ingredient.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteIngredient = async (ingredientId: string) => {
    toast.warning("Are you sure you want to delete this ingredient?", {
      description: "This may affect products and claims using this ingredient. This action cannot be undone.",
      action: {
        label: "Delete",
        onClick: async () => {
          setIsSubmittingModal(true); // Use general submitting flag
          try {
            const response = await fetch(`/api/ingredients/${ingredientId}`, { method: 'DELETE' });
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: "Failed to delete ingredient" }));
              throw new Error(errorData.error || "Server error during deletion.");
            }
            const result = await response.json();
            if (result.success) {
              toast.success(result.message || "Ingredient deleted successfully.");
              fetchIngredients();
            } else {
              throw new Error(result.error || "Failed to delete ingredient from server.");
            }
          } catch (err: any) {
            console.error("Error deleting ingredient:", err);
            toast.error("Failed to delete ingredient.", { description: err.message });
          } finally {
            setIsSubmittingModal(false);
          }
        }
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
      duration: 10000,
    });
  };
  
  const handleOpenAddModal = () => {
    setEditingIngredient(null);
    setIngredientName("");
    setIngredientDescription("");
    setShowIngredientModal(true);
  };

  const handleOpenEditModal = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setIngredientName(ingredient.name);
    setIngredientDescription(ingredient.description || "");
    setShowIngredientModal(true);
  };

  const handleModalFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ingredientName.trim()) {
      toast.error("Ingredient name is required.");
      return;
    }
    setIsSubmittingModal(true);

    const url = editingIngredient ? `/api/ingredients/${editingIngredient.id}` : "/api/ingredients";
    const method = editingIngredient ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ingredientName.trim(), description: ingredientDescription.trim() || null }), // Ensure empty description is null
      });
      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(`Ingredient ${editingIngredient ? 'updated' : 'created'} successfully!`);
        setShowIngredientModal(false);
        fetchIngredients();
      } else {
        toast.error(`Failed to ${editingIngredient ? 'update' : 'create'} ingredient.`, {
          description: result.error || "An unknown server error occurred.",
        });
      }
    } catch (error: any) {
      console.error(`Error ${editingIngredient ? 'updating' : 'creating'} ingredient:`, error);
      toast.error(`An unexpected error occurred during save.`, { description: error.message });
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const breadcrumbItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/claims/manage", label: "Claims Management" },
    { label: "Ingredients", isCurrent: true }
  ];

  if (isLoading && ingredients.length === 0) { // Show full page loader only on initial load without data
    return (
      <div className="p-4 md:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading ingredients...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ingredients</h1>
          <UiCardDescription className="mt-1">
            Manage ingredients that can be associated with products and claims.
          </UiCardDescription>
        </div>
        <Button onClick={handleOpenAddModal} disabled={isSubmittingModal}> 
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Ingredient
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Leaf className="mr-2 h-5 w-5"/> Ingredient List</CardTitle>
           <UiCardDescription>
            Browse, search, and manage all registered ingredients.
          </UiCardDescription>
          <div className="mt-4 pt-4 border-t">
            <Label htmlFor="ingredientSearchInput" className="sr-only">Search Ingredients</Label>
            <div className="relative w-full md:w-1/2 lg:w-1/3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="ingredientSearchInput"
                type="search"
                placeholder="Search ingredients by name or description..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-10 w-full"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && !isLoading && (
            <div className="mb-4 p-4 border border-destructive bg-destructive/10 rounded-md text-destructive flex items-start">
              <AlertTriangle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Error Loading Ingredients:</p>
                <p className="text-sm">{error}</p>
                <Button onClick={fetchIngredients} variant="outline" size="sm" className="mt-2">Try Again</Button>
              </div>
            </div>
          )}
          {isLoading && ingredients.length > 0 && (
             <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin"/> Updating list...
            </div>
          )}
          {!isLoading && filteredIngredients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3" />
              <p className="font-semibold">{searchTerm ? "No Ingredients Match Search" : "No Ingredients Found"}</p>
              <p className="text-center">
                {searchTerm
                  ? "Try adjusting your search terms or clear the search."
                  : "Click \"Add New Ingredient\" to create one."}
              </p>
              {searchTerm && (
                <Button variant="outline" onClick={() => setSearchTerm("")} className="mt-6">
                  Clear Search
                </Button>
              )}
            </div>
          )}
          {!isLoading && filteredIngredients.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead className="hidden md:table-cell">Created At</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIngredients.map((ingredient) => (
                  <TableRow key={ingredient.id}>
                    <TableCell className="font-medium">{ingredient.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate hidden sm:table-cell">
                      {ingredient.description || "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{new Date(ingredient.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(ingredient)} title={`Edit ${ingredient.name}`} disabled={isSubmittingModal}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit {ingredient.name}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteIngredient(ingredient.id)} title={`Delete ${ingredient.name}`} disabled={isSubmittingModal} className="text-destructive hover:text-destructive/90">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {ingredient.name}</span>
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

      <Dialog open={showIngredientModal} onOpenChange={(isOpen) => { if (!isSubmittingModal) setShowIngredientModal(isOpen); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingIngredient ? 'Edit' : 'Add New'} Ingredient</DialogTitle>
            <DialogDescription>
              {editingIngredient ? 'Update the details of this ingredient.' : 'Provide the name and optionally a description for the new ingredient.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleModalFormSubmit} className="space-y-4 py-2 pb-4">
            <div>
              <Label htmlFor="ingredientNameInput">Name*</Label>
              <Input
                id="ingredientNameInput"
                value={ingredientName}
                onChange={(e) => setIngredientName(e.target.value)}
                placeholder="e.g., Aloe Vera Extract"
                required
                aria-required="true"
              />
            </div>
            <div>
              <Label htmlFor="ingredientDescriptionInput">Description (Optional)</Label>
              <Textarea
                id="ingredientDescriptionInput"
                value={ingredientDescription}
                onChange={(e) => setIngredientDescription(e.target.value)}
                placeholder="e.g., Soothing natural extract used in cosmetics."
                rows={3}
              />
               <p className="text-xs text-muted-foreground mt-1">Briefly describe the ingredient and its common uses or properties.</p>
            </div>
            <DialogFooter className="pt-4 border-t">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmittingModal}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmittingModal || !ingredientName.trim()} className="min-w-[90px]">
                {isSubmittingModal ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : (editingIngredient ? 'Save Changes' : 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 