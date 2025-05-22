"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
// No Link import needed if "Add New" is modal-only
import { Button } from "@/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
  DialogTrigger,
  DialogClose // Added DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea"; // Assuming you have this
import { Label } from "@/components/ui/label";
import { PlusCircle, Edit, Trash2, PackageOpen, AlertTriangle, Search, ListTree, Loader2 } from "lucide-react";
import { toast } from "sonner";


// Define interfaces based on expected API response (matching stubs)
interface Ingredient {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  // Add other fields as necessary
}

export default function ClaimsIngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // States for managing Add/Edit Ingredient Modal
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingredientName, setIngredientName] = useState("");
  const [ingredientDescription, setIngredientDescription] = useState("");
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  const fetchIngredients = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/ingredients");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to fetch ingredients" }));
        throw new Error(errorData.error || "Failed to fetch ingredients");
      }
      const data = await response.json();
      if (data.success) {
        setIngredients(Array.isArray(data.data) ? data.data : []);
      } else {
        throw new Error(data.error || "Unknown error fetching ingredients");
      }
    } catch (err: any) {
      console.error("Error fetching ingredients:", err);
      setError(err.message || "An unexpected error occurred.");
      toast.error("Failed to load ingredients.", { description: err.message });
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
    // TODO: Implement actual delete functionality with confirmation
    // Example: if (!confirm("Are you sure? This might affect products and claims.")) return;
    toast.info(`Attempting to delete ingredient ${ingredientId}...`);
    try {
      const response = await fetch(`/api/ingredients/${ingredientId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to delete ingredient" }));
        throw new Error(errorData.error || "Server error during deletion.");
      }
      const result = await response.json();
      if (result.success) {
        toast.success(result.message || "Ingredient deleted successfully.");
        fetchIngredients(); // Refresh list
      } else {
        throw new Error(result.error || "Failed to delete ingredient.");
      }
    } catch (err: any) {
      console.error("Error deleting ingredient:", err);
      toast.error("Failed to delete ingredient.", { description: err.message });
    }
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
    setIsSubmittingModal(true);

    if (!ingredientName.trim()) {
      toast.error("Ingredient name is required.");
      setIsSubmittingModal(false);
      return;
    }

    const url = editingIngredient ? `/api/ingredients/${editingIngredient.id}` : "/api/ingredients";
    const method = editingIngredient ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ingredientName, description: ingredientDescription }),
      });
      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(`Ingredient ${editingIngredient ? 'updated' : 'created'} successfully!`);
        setShowIngredientModal(false);
        fetchIngredients(); // Refresh the list
      } else {
        toast.error(`Failed to ${editingIngredient ? 'update' : 'create'} ingredient.`, {
          description: result.error || "An unknown error occurred.",
        });
      }
    } catch (error: any) {
      console.error(`Error ${editingIngredient ? 'updating' : 'creating'} ingredient:`, error);
      toast.error(`An unexpected error occurred.`, { description: error.message });
    } finally {
      setIsSubmittingModal(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <ListTree className="h-12 w-12 animate-pulse text-muted-foreground" />
        <p className="ml-4 text-muted-foreground">Loading ingredients...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p className="text-xl font-semibold">Error loading ingredients</p>
        <p>{error}</p>
        <Button onClick={fetchIngredients} variant="outline" className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ingredients for Claims</h1>
          <p className="text-muted-foreground">
            Manage ingredients that can be associated with products and claims.
          </p>
        </div>
        <Button onClick={handleOpenAddModal}> 
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Ingredient
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ingredient List</CardTitle>
          <div className="mt-4 flex flex-col md:flex-row gap-2 items-center">
            <div className="relative w-full md:flex-grow">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search ingredients by name or description..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-8 w-full"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredIngredients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ListTree className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Ingredients Found</h3>
              <p className="text-muted-foreground">
                {searchTerm
                  ? "No ingredients match your search criteria."
                  : "There are no ingredients to display. Try adding a new one!"}
              </p>
              {searchTerm && (
                <Button variant="outline" onClick={() => setSearchTerm("")} className="mt-4">
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIngredients.map((ingredient) => (
                    <TableRow key={ingredient.id}>
                      <TableCell className="font-medium">{ingredient.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm truncate max-w-xs">
                        {ingredient.description || "-"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(ingredient)} title="Edit Ingredient">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteIngredient(ingredient.id)} title="Delete Ingredient">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {showIngredientModal && (
        <Dialog open={showIngredientModal} onOpenChange={setShowIngredientModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingIngredient ? "Edit" : "Add New"} Ingredient</DialogTitle>
              <DialogDescription>
                {editingIngredient ? "Update the" : "Fill in the"} details for the ingredient. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleModalFormSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="ingredientNameModal" className="text-right">
                    Name*
                  </Label>
                  <Input 
                    id="ingredientNameModal" 
                    value={ingredientName} 
                    onChange={(e) => setIngredientName(e.target.value)} 
                    className="col-span-3"
                    placeholder="e.g., Vanilla Extract"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="ingredientDescriptionModal" className="text-right">
                    Description
                  </Label>
                  <Textarea 
                    id="ingredientDescriptionModal" 
                    value={ingredientDescription} 
                    onChange={(e) => setIngredientDescription(e.target.value)} 
                    className="col-span-3"
                    placeholder="Details about the ingredient (optional)"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" onClick={() => setShowIngredientModal(false)}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmittingModal}>
                  {isSubmittingModal ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    "Save Ingredient"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 