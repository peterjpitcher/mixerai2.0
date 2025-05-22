"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  // DialogFooter, // Footer is handled by AddEditClaimForm
  // DialogTrigger, // Trigger is manual via button
  // DialogClose // Close is handled by AddEditClaimForm
} from "@/components/ui/dialog";
import { AddEditClaimForm } from "@/components/claims/add-edit-claim-form"; // Import the new form
import { PlusCircle, Edit, Trash2, Filter, AlertTriangle, Search, FileText, Tag, Building, Package as ProductIcon, Leaf, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CLAIM_COUNTRY_GLOBAL, COUNTRIES } from "@/lib/constants";
import { Label } from "@/components/ui/label";

// Interfaces (should align with API stubs and claims-utils.ts)
interface Claim {
  id: string;
  claim_text: string;
  claim_type: 'allowed' | 'disallowed' | 'mandatory';
  level: 'brand' | 'product' | 'ingredient';
  global_brand_id?: string | null;
  product_id?: string | null;
  ingredient_id?: string | null;
  country_code: string;
  description?: string | null;
  created_at: string;
}

interface Brand {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  global_brand_id: string | null;
  brand_name?: string;
}

interface Ingredient {
  id: string;
  name: string;
}

const claimLevelOptions = [
  { value: "all", label: "All Levels" },
  { value: "brand", label: "Brand" },
  { value: "product", label: "Product" },
  { value: "ingredient", label: "Ingredient" },
];

const claimTypeOptions = [
  { value: "all", label: "All Types" },
  { value: "allowed", label: "Allowed" },
  { value: "disallowed", label: "Disallowed" },
  { value: "mandatory", label: "Mandatory" },
];

export default function ClaimsManagePage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Filters
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>("all"); // Renamed to avoid conflict with form state if any
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("all");
  const [selectedIngredientFilter, setSelectedIngredientFilter] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>(CLAIM_COUNTRY_GLOBAL);
  const [selectedClaimType, setSelectedClaimType] = useState<string>("all");

  // Data for filters
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]); // All products for dropdown
  const [ingredients, setIngredients] = useState<Ingredient[]>([]); // All ingredients
  const [globalClaimBrands, setGlobalClaimBrands] = useState<Brand[]>([]); // For brand-level claims

  // Modal State
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false); // For main page context if needed, form handles its own.

  // State for Brand-wide AI Review Modal
  const [showBrandAiReviewModal, setShowBrandAiReviewModal] = useState(false);
  const [selectedBrandForAiReview, setSelectedBrandForAiReview] = useState<string>("");
  const [brandAiReviewContent, setBrandAiReviewContent] = useState<string | null>(null);
  const [isLoadingBrandAiReview, setIsLoadingBrandAiReview] = useState(false);
  const [brandAiReviewError, setBrandAiReviewError] = useState<string | null>(null);

  const fetchFiltersData = useCallback(async () => {
    // setIsLoading(true); // May cause whole page to show loading for filter data
    try {
      const brandsRes = await fetch("/api/brands");
      const brandsData = await brandsRes.json();
      if (brandsData.success) setBrands(brandsData.data || []);
      else toast.error("Failed to load brands for filters.");

      const productsRes = await fetch("/api/products"); // Fetch all products for filtering
      const productsData = await productsRes.json();
      if (productsData.success) setProducts(productsData.data || []);
      else toast.error("Failed to load products for filters.");

      const ingredientsRes = await fetch("/api/ingredients");
      const ingredientsData = await ingredientsRes.json();
      if (ingredientsData.success) setIngredients(ingredientsData.data || []);
      else toast.error("Failed to load ingredients for filters.");

      const globalBrandsRes = await fetch("/api/global-claim-brands");
      const globalBrandsData = await globalBrandsRes.json();
      if (globalBrandsData.success) setGlobalClaimBrands(globalBrandsData.data || []);
      else toast.error("Failed to load global claim brands for filters.");

    } catch (err) {
      console.error("Failed to load filter data", err);
      toast.error("Could not load filter options.");
    }
    // setIsLoading(false);
  }, []);

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (selectedLevel !== "all") params.append("level", selectedLevel);
    if (selectedBrandFilter !== "all" && selectedLevel === 'brand') params.append("brand_id", selectedBrandFilter);
    if (selectedProductFilter !== "all" && selectedLevel === 'product') params.append("product_id", selectedProductFilter);
    if (selectedIngredientFilter !== "all" && selectedLevel === 'ingredient') params.append("ingredient_id", selectedIngredientFilter);
    if (selectedCountry !== "all") params.append("country_code", selectedCountry);
    if (selectedClaimType !== "all") params.append("claim_type", selectedClaimType);

    try {
      const response = await fetch(`/api/claims?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to fetch claims" }));
        throw new Error(errorData.error || "Failed to fetch claims");
      }
      const data = await response.json();
      if (data.success) {
        setClaims(Array.isArray(data.data) ? data.data : []);
      } else {
        throw new Error(data.error || "Unknown error fetching claims");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      toast.error("Failed to load claims.", { description: err.message });
      setClaims([]); // Clear claims on error
    } finally {
      setIsLoading(false);
    }
  }, [selectedLevel, selectedBrandFilter, selectedProductFilter, selectedIngredientFilter, selectedCountry, selectedClaimType]);

  useEffect(() => {
    fetchFiltersData();
  }, [fetchFiltersData]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  // Reset dependent filters when a primary filter changes
  useEffect(() => {
    setSelectedProductFilter("all");
    setSelectedIngredientFilter("all");
    // If level is not 'brand' or 'product', reset brand filter.
    // Brand filter is relevant for both brand level and for filtering products.
    if (selectedLevel !== 'brand' && selectedLevel !== 'product') {
      setSelectedBrandFilter("all");
    }
  }, [selectedLevel]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const filteredClaims = claims.filter((claim) =>
    claim.claim_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (claim.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleOpenAddClaimModal = () => {
    setEditingClaim(null);
    setShowClaimModal(true);
  };

  const handleOpenEditClaimModal = (claim: Claim) => {
    setEditingClaim(claim);
    setShowClaimModal(true);
  };

  const handleSaveClaim = async (claimData: Omit<Claim, 'id' | 'created_at'> & { id?: string }) => {
    setIsSubmittingClaim(true); // Consider if this state is needed or form handles its own submit state view
    const url = claimData.id ? `/api/claims/${claimData.id}` : "/api/claims";
    const method = claimData.id ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claimData),
      });
      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(`Claim ${claimData.id ? 'updated' : 'created'} successfully!`);
        setShowClaimModal(false);
        fetchClaims(); // Refresh the list
      } else {
        toast.error(`Failed to ${claimData.id ? 'update' : 'create'} claim.`, {
          description: result.error || "An unknown error occurred.",
        });
      }
    } catch (error: any) {
      console.error(`Error ${claimData.id ? 'updating' : 'creating'} claim:`, error);
      toast.error(`An unexpected error occurred.`, { description: error.message });
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const handleDeleteClaim = async (claimId: string) => {
    toast.info(`Attempting to delete claim ${claimId}...`);
     try {
      const response = await fetch(`/api/claims/${claimId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to delete claim" }));
        throw new Error(errorData.error || "Server error during deletion.");
      }
      const result = await response.json();
      if (result.success) {
        toast.success(result.message || "Claim deleted successfully.");
        fetchClaims(); // Refresh list
      } else {
        throw new Error(result.error || "Failed to delete claim.");
      }
    } catch (err: any) {
      console.error("Error deleting claim:", err);
      toast.error("Failed to delete claim.", { description: err.message });
    }
  };

  const getEntityName = (claim: Claim) => {
    if (claim.level === 'brand' && claim.global_brand_id) {
      return globalClaimBrands.find(b => b.id === claim.global_brand_id)?.name || claim.global_brand_id;
    }
    if (claim.level === 'product' && claim.product_id) {
      return products.find(p => p.id === claim.product_id)?.name || claim.product_id;
    }
    if (claim.level === 'ingredient' && claim.ingredient_id) {
      return ingredients.find(i => i.id === claim.ingredient_id)?.name || claim.ingredient_id;
    }
    return 'N/A';
  };

  const handleOpenBrandAiReviewModal = () => {
    if (!selectedBrandForAiReview) {
      toast.error("Please select a brand to review.");
      return;
    }
    setBrandAiReviewContent(null);
    setBrandAiReviewError(null);
    setShowBrandAiReviewModal(true);
    // Trigger fetching AI review content
    fetchBrandAiReview(); 
  };

  const fetchBrandAiReview = async () => {
    if (!selectedBrandForAiReview) return;
    setIsLoadingBrandAiReview(true);
    try {
      const response = await fetch(`/api/ai/brands/${selectedBrandForAiReview}/review-all-claims`);
      const result = await response.json();
      if (response.ok && result.success) {
        setBrandAiReviewContent(result.analysis);
      } else {
        setBrandAiReviewError(result.error || "Failed to get AI brand review.");
        toast.error("Failed to load AI brand review.", { description: result.error });
      }
    } catch (err: any) {
      console.error("Error fetching AI brand review:", err);
      setBrandAiReviewError(err.message || "An unexpected error occurred.");
      toast.error("An unexpected error occurred during AI brand review.", { description: err.message });
    } finally {
      setIsLoadingBrandAiReview(false);
    }
  };

  // Render Add/Edit Modal Content
  const renderClaimModalContent = () => {
    if (!showClaimModal) return null;
    return (
      <AddEditClaimForm
        claimToEdit={editingClaim}
        onSave={handleSaveClaim}
        onCancel={() => setShowClaimModal(false)}
        brands={brands} 
        products={products} 
        ingredients={ingredients}
        globalClaimBrands={globalClaimBrands} // Pass the new prop
      />
    );
  }

  if (isLoading && claims.length === 0) { 
    return (
      <div className="flex justify-center items-center h-64">
        <Filter className="h-12 w-12 animate-pulse text-muted-foreground" />
        <p className="ml-4 text-muted-foreground">Loading claims...</p>
      </div>
    );
  }

  if (error && claims.length === 0) { // Show full page error only if no claims are loaded at all
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p className="text-xl font-semibold">Error loading claims</p>
        <p>{error}</p>
        <Button onClick={fetchClaims} variant="outline" className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Claims</h1>
          <p className="text-muted-foreground">
            Define, view, and manage all claims for brands, products, and ingredients.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <Select value={selectedBrandForAiReview} onValueChange={setSelectedBrandForAiReview}>
                <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Select Brand for AI Review" />
                </SelectTrigger>
                <SelectContent>
                    {brands.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading brands...</div>
                    ) : (
                        brands.map(brand => brand.id && <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)
                    )}
                </SelectContent>
            </Select>
            <Button onClick={handleOpenBrandAiReviewModal} disabled={!selectedBrandForAiReview || isLoadingBrandAiReview} className="w-full sm:w-auto">
                <Sparkles className="mr-2 h-4 w-4" /> 
                {isLoadingBrandAiReview ? "Analyzing..." : "Review Brand Claims (AI)"}
            </Button>
            <Button onClick={handleOpenAddClaimModal} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Claim
            </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {/* Level Filter */}
            <div className="min-w-[150px]">
              <Label htmlFor="levelFilter">Filter by Level</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger id="levelFilter"><SelectValue placeholder="All Levels" /></SelectTrigger>
                <SelectContent>
                  {claimLevelOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Global Brand Filter - Shown for 'brand' and 'product' levels */}
            {(selectedLevel === 'brand' || selectedLevel === 'product') && (
              <div className="min-w-[200px]">
                <Label htmlFor="brandFilter">Filter by Global Brand</Label>
                <Select 
                  value={selectedBrandFilter} 
                  onValueChange={(value) => {
                    setSelectedBrandFilter(value);
                    if (selectedLevel === 'product') {
                      setSelectedProductFilter('all'); // Reset product filter when brand changes
                    }
                  }}
                >
                  <SelectTrigger id="brandFilter"><SelectValue placeholder="All Global Brands" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Global Brands</SelectItem>
                    {globalClaimBrands.filter(brand => brand.id).map(brand => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Product Filter - Shown only for 'product' level */}
            {selectedLevel === 'product' && (
              <div className="min-w-[200px]">
                <Label htmlFor="productFilter">Filter by Product</Label>
                <Select 
                  value={selectedProductFilter} 
                  onValueChange={setSelectedProductFilter}
                  disabled={selectedBrandFilter === 'all' && globalClaimBrands.length > 0} // Disable if a specific global brand isn't selected first (unless no global brands exist)
                >
                  <SelectTrigger id="productFilter">
                    <SelectValue placeholder="All Products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {products
                      .filter(prod => prod.id && (selectedBrandFilter === 'all' || prod.global_brand_id === selectedBrandFilter))
                      .map(prod => (
                        <SelectItem key={prod.id} value={prod.id}>
                          {prod.name} ({prod.brand_name || 'No Brand'})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Ingredient Filter - Shown only for 'ingredient' level */}
            {selectedLevel === 'ingredient' && (
              <Select value={selectedIngredientFilter} onValueChange={setSelectedIngredientFilter}>
                <SelectTrigger><SelectValue placeholder="Select Ingredient" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ingredients</SelectItem>
                  {ingredients.filter(ing => ing.id).map(ing => <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <Select value={selectedClaimType} onValueChange={setSelectedClaimType}>
              <SelectTrigger><SelectValue placeholder="Filter by type" /></SelectTrigger>
              <SelectContent>
                {claimTypeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger><SelectValue placeholder="Filter by country" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value={CLAIM_COUNTRY_GLOBAL}>Global (Default)</SelectItem>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.value} value={country.value}>
                    {country.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative sm:col-span-2 md:col-span-1 lg:col-span-2 xl:col-span-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search in claim text or description..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-8 w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claims List Card */}
      <Card>
        <CardHeader>
          <CardTitle>Claim List ({filteredClaims.length})</CardTitle>
           {isLoading && claims.length > 0 && <p className="text-muted-foreground text-sm flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating claims list...</p>}
           {error && <p className="text-destructive text-sm">Error loading claims: {error}. Displaying cached or incomplete data.</p>} 
        </CardHeader>
        <CardContent>
          {filteredClaims.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Claims Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || selectedLevel !== 'all' || selectedCountry !== CLAIM_COUNTRY_GLOBAL || selectedClaimType !== 'all' || selectedBrandFilter !== 'all' || selectedProductFilter !== 'all' || selectedIngredientFilter !== 'all'
                  ? "No claims match your current filter criteria."
                  : "There are no claims defined yet. Try adding a new one!"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Level</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="min-w-[250px]">Claim Text</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClaims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell>
                        <span className="inline-flex items-center capitalize">
                          {claim.level === 'brand' && <Building className="mr-1.5 h-4 w-4 text-sky-500" />}
                          {claim.level === 'product' && <ProductIcon className="mr-1.5 h-4 w-4 text-purple-500" />}
                          {claim.level === 'ingredient' && <Leaf className="mr-1.5 h-4 w-4 text-green-500" />}
                          {claim.level}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{getEntityName(claim)}</TableCell>
                      <TableCell className="text-sm">{claim.claim_text}</TableCell>
                      <TableCell className="capitalize text-sm">{claim.claim_type}</TableCell>
                      <TableCell className="text-sm">
                        {claim.country_code === CLAIM_COUNTRY_GLOBAL 
                          ? "Global" 
                          : COUNTRIES.find(c => c.value === claim.country_code)?.label || claim.country_code}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" title="Edit Claim" onClick={() => handleOpenEditClaimModal(claim)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClaim(claim.id)} title="Delete Claim">
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

      {showClaimModal && (
        <Dialog open={showClaimModal} onOpenChange={setShowClaimModal}>
          <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingClaim ? "Edit" : "Add New"} Claim</DialogTitle>
              <DialogDescription>
                {editingClaim ? "Update the details of this claim." : "Fill in the form below to create a new claim."}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 max-h-[70vh] overflow-y-auto px-2">
              {renderClaimModalContent()}
            </div>
            {/* Footer is now part of AddEditClaimForm */}
          </DialogContent>
        </Dialog>
      )}

      {/* Brand-wide AI Review Modal */}
      {showBrandAiReviewModal && (
        <Dialog open={showBrandAiReviewModal} onOpenChange={setShowBrandAiReviewModal}>
          <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-3xl xl:max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-sky-500" /> 
                AI-Powered Holistic Brand Claims Review
              </DialogTitle>
              <DialogDescription>
                Analysis for brand: {brands.find(b => b.id === selectedBrandForAiReview)?.name || selectedBrandForAiReview}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 max-h-[60vh] overflow-y-auto prose prose-sm max-w-none whitespace-pre-wrap">
              {isLoadingBrandAiReview && (
                <div className="flex items-center justify-center space-x-2 text-muted-foreground py-10">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span>Generating comprehensive AI analysis for the brand... This may take a moment.</span>
                </div>
              )}
              {brandAiReviewError && !isLoadingBrandAiReview && (
                <div className="text-destructive p-4 border border-destructive/50 rounded-md">
                  <AlertTriangle className="inline h-5 w-5 mr-2" />
                  Error loading AI brand review: {brandAiReviewError}
                </div>
              )}
              {!isLoadingBrandAiReview && !brandAiReviewError && brandAiReviewContent && (
                <>{brandAiReviewContent}</>
              )}
              {!isLoadingBrandAiReview && !brandAiReviewError && !brandAiReviewContent && (
                 <p className="text-muted-foreground text-center py-10">No AI review content to display.</p>
              )}
            </div>
            {/* No explicit footer, close is handled by onOpenChange or X button */}
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
} 