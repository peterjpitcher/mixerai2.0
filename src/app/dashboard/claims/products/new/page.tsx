"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/card";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea"; // Assuming you have this
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox"; // For multi-select ingredients
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Brand {
  id: string;
  name: string;
}

interface Ingredient {
  id: string;
  name: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([]);
  
  const [brands, setBrands] = useState<Brand[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [isLoadingIngredients, setIsLoadingIngredients] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchBrands() {
      setIsLoadingBrands(true);
      try {
        const response = await fetch("/api/global-claim-brands");
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setBrands(data.data);
        } else {
          toast.error("Failed to load brands.", { description: data.error || "Unexpected data format" });
        }
      } catch (error) {
        toast.error("Error loading brands.");
        console.error("Error fetching brands:", error);
      }
      setIsLoadingBrands(false);
    }
    fetchBrands();
  }, []);

  useEffect(() => {
    async function fetchIngredients() {
      setIsLoadingIngredients(true);
      try {
        const response = await fetch("/api/ingredients");
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setIngredients(data.data);
        } else {
          toast.error("Failed to load ingredients.", { description: data.error });
        }
      } catch (error) {
        toast.error("Error loading ingredients.");
        console.error("Error fetching ingredients:", error);
      }
      setIsLoadingIngredients(false);
    }
    fetchIngredients();
  }, []);

  const handleIngredientToggle = (ingredientId: string) => {
    setSelectedIngredientIds((prev) =>
      prev.includes(ingredientId)
        ? prev.filter((id) => id !== ingredientId)
        : [...prev, ingredientId]
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (!name.trim()) {
      toast.error("Product name is required.");
      setIsSubmitting(false);
      return;
    }
    if (!selectedBrandId) {
      toast.error("Please select a brand.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          global_brand_id: selectedBrandId,
          ingredient_ids: selectedIngredientIds,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success("Product created successfully!");
        router.push("/dashboard/claims/products"); // Redirect to products list
      } else {
        toast.error("Failed to create product.", {
          description: result.error || "An unknown error occurred.",
        });
      }
    } catch (error: any) {
      console.error("Error creating product:", error);
      toast.error("An unexpected error occurred while creating the product.", {
        description: error.message,
      });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/claims/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Add New Product</CardTitle>
          <CardDescription>
            Fill in the details below to create a new product. Products can be associated with claims.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name*</Label>
              <Input 
                id="productName" 
                placeholder="e.g., Super Sparkle Toothpaste"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="productDescription">Description (Optional)</Label>
              <Textarea
                id="productDescription"
                placeholder="Enter a brief description of the product..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Brand*</Label>
              {isLoadingBrands ? (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> <span>Loading brands...</span>
                </div>
              ) : brands.length > 0 ? (
                <Select value={selectedBrandId} onValueChange={setSelectedBrandId} required>
                  <SelectTrigger id="brand">
                    <SelectValue placeholder="Select a brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">No brands available. Please create a brand first.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Ingredients (Optional)</Label>
              {isLoadingIngredients ? (
                 <div className="flex items-center space-x-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> <span>Loading ingredients...</span>
                </div>
              ) : ingredients.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-4">
                  {ingredients.map((ingredient) => (
                    <div key={ingredient.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`ingredient-${ingredient.id}`}
                        checked={selectedIngredientIds.includes(ingredient.id)}
                        onCheckedChange={() => handleIngredientToggle(ingredient.id)}
                      />
                      <Label htmlFor={`ingredient-${ingredient.id}`} className="font-normal">
                        {ingredient.name}
                      </Label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No ingredients available to select.</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || isLoadingBrands || isLoadingIngredients || (brands.length === 0 && !isLoadingBrands)}>
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                "Create Product"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 