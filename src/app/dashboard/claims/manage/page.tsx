"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from "@/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { AddEditClaimForm } from "@/components/claims/add-edit-claim-form";
import { PlusCircle, Edit, Trash2, Filter, AlertTriangle, Search, FileText, Tag, Building, Package as ProductIcon, Leaf, Loader2, Sparkles, ChevronRight, X, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { CLAIM_COUNTRY_GLOBAL, COUNTRIES } from "@/lib/constants";
import { Label } from "@/components/ui/label";

// Interfaces
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
  brand_name?: string;
  product_name?: string;
  ingredient_name?: string;
}

interface Brand { id: string; name: string; }
interface Product { id: string; name: string; global_brand_id: string | null; brand_name?: string; }
interface Ingredient { id: string; name: string; }

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

export default function ClaimsManagePage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>("all");
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("all");
  const [selectedIngredientFilter, setSelectedIngredientFilter] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>(CLAIM_COUNTRY_GLOBAL);
  const [selectedClaimType, setSelectedClaimType] = useState<string>("all");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [productsState, setProductsState] = useState<Product[]>([]);
  const [ingredientsState, setIngredientsState] = useState<Ingredient[]>([]);
  const [globalClaimBrands, setGlobalClaimBrands] = useState<Brand[]>([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [showBrandAiReviewModal, setShowBrandAiReviewModal] = useState(false);
  const [selectedBrandForAiReview, setSelectedBrandForAiReview] = useState<string>("");
  const [brandAiReviewContent, setBrandAiReviewContent] = useState<string | null>(null);
  const [isLoadingBrandAiReview, setIsLoadingBrandAiReview] = useState(false);
  const [brandAiReviewError, setBrandAiReviewError] = useState<string | null>(null);

  const fetchFiltersData = useCallback(async () => {
    try {
      const [brandsRes, productsRes, ingredientsRes, globalBrandsRes] = await Promise.all([
        fetch("/api/brands"),
        fetch("/api/products"),
        fetch("/api/ingredients"),
        fetch("/api/global-claim-brands")
      ]);
      const brandsData = await brandsRes.json();
      if (brandsData.success) setBrands(brandsData.data || []);
      else toast.error("Failed to load brands for filters.");
      const productsData = await productsRes.json();
      if (productsData.success) {
        const enrichedProducts = productsData.data.map((p: Product) => {
            const brand = brandsData.data?.find((b: Brand) => b.id === p.global_brand_id);
            return { ...p, brand_name: brand?.name || 'Unknown Brand' };
        });
        setProductsState(enrichedProducts || []);
      } else toast.error("Failed to load products for filters.");
      const ingredientsData = await ingredientsRes.json();
      if (ingredientsData.success) setIngredientsState(ingredientsData.data || []);
      else toast.error("Failed to load ingredients for filters.");
      const globalBrandsData = await globalBrandsRes.json();
      if (globalBrandsData.success) setGlobalClaimBrands(globalBrandsData.data || []);
      else toast.error("Failed to load global claim brands for filters.");
    } catch (err) {
      console.error("Failed to load filter data", err);
      toast.error("Could not load filter options.");
    }
  }, []);

  const fetchClaims = useCallback(async () => {
    setIsLoading(true); setError(null);
    const params = new URLSearchParams();
    if (selectedLevel !== "all") params.append("level", selectedLevel);
    if (selectedBrandFilter !== "all" && selectedLevel === 'brand') params.append("global_brand_id", selectedBrandFilter);
    else if (selectedBrandFilter !== "all" && selectedLevel === 'product') params.append("brand_id_for_product", selectedBrandFilter);
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
      if (data.success) setClaims(Array.isArray(data.data) ? data.data : []);
      else throw new Error(data.error || "Unknown error fetching claims");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      toast.error("Failed to load claims.", { description: err.message });
      setClaims([]);
    } finally { setIsLoading(false); }
  }, [selectedLevel, selectedBrandFilter, selectedProductFilter, selectedIngredientFilter, selectedCountry, selectedClaimType]);

  useEffect(() => { fetchFiltersData(); }, [fetchFiltersData]);
  useEffect(() => { fetchClaims(); }, [fetchClaims]);
  useEffect(() => {
    if (selectedLevel !== 'product') setSelectedProductFilter("all");
    if (selectedLevel !== 'ingredient') setSelectedIngredientFilter("all");
    if (selectedLevel !== 'brand' && selectedLevel !== 'product') setSelectedBrandFilter("all");
  }, [selectedLevel]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value);
  const filteredClaims = claims.filter(claim =>
    claim.claim_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (claim.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );
  const handleOpenAddClaimModal = () => { setEditingClaim(null); setShowClaimModal(true); };
  const handleOpenEditClaimModal = (claim: Claim) => { setEditingClaim(claim); setShowClaimModal(true); };
  const handleSaveClaim = async (claimData: Omit<Claim, 'id' | 'created_at'> & { id?: string }) => { setShowClaimModal(false); fetchClaims(); };
  const handleDeleteClaim = async (claimId: string) => {
    toast.warning("Are you sure you want to delete this claim?", {
      action: { label: "Delete", onClick: async () => {
        try {
          const response = await fetch(`/api/claims/${claimId}`, { method: 'DELETE' });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Failed to delete claim" }));
            throw new Error(errorData.error || "Server error during deletion.");
          }
          const result = await response.json();
          if (result.success) { toast.success(result.message || "Claim deleted successfully."); fetchClaims(); }
          else throw new Error(result.error || "Failed to delete claim.");
        } catch (err: any) {
          console.error("Error deleting claim:", err);
          toast.error("Failed to delete claim.", { description: err.message });
        }
      }},
      cancel: { label: "Cancel", onClick: () => {} },
      duration: 10000,
    });
  };
  const getEntityName = (claim: Claim): string => {
    if (claim.level === 'brand') return claim.brand_name || claim.global_brand_id || 'N/A';
    if (claim.level === 'product') return claim.product_name || claim.product_id || 'N/A';
    if (claim.level === 'ingredient') return claim.ingredient_name || claim.ingredient_id || 'N/A';
    return 'N/A';
  };
  const getParentBrandNameForProduct = (productId?: string | null): string => {
    if (!productId) return 'N/A';
    const product = productsState.find(p => p.id === productId);
    return product?.brand_name || 'Unknown Brand';
  };
  const handleOpenBrandAiReviewModal = () => {
    if (!selectedBrandFilter || selectedBrandFilter === "all") {
      toast.info("Please select a specific brand to review its claims."); return;
    }
    setSelectedBrandForAiReview(selectedBrandFilter);
    setBrandAiReviewContent(null); setBrandAiReviewError(null); setShowBrandAiReviewModal(true);
    fetchBrandAiReview(selectedBrandFilter);
  };
  const fetchBrandAiReview = async (brandId: string) => {
    if (!brandId || brandId === "all") return;
    setIsLoadingBrandAiReview(true); setBrandAiReviewError(null);
    try {
      const response = await fetch(`/api/ai/brands/${brandId}/review-all-claims`);
      const result = await response.json();
      if (response.ok && result.success) setBrandAiReviewContent(result.analysis || "No analysis content returned.");
      else throw new Error(result.error || `Failed to get AI review for brand ${brandId}.`);
    } catch (err: any) {
      setBrandAiReviewError(err.message || "An unexpected error occurred during AI brand review.");
      toast.error("Failed to load AI brand review.", { description: err.message });
    } finally { setIsLoadingBrandAiReview(false); }
  };
  const breadcrumbItems = [{ href: "/dashboard", label: "Dashboard" }, { label: "Claims Management", isCurrent: true }];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Claims Management</h1>
          <p className="text-muted-foreground mt-1">View, manage, create, and review claims for your brands, products, and ingredients.</p>
        </div>
        <div className="flex-shrink-0">
          <Button onClick={handleOpenAddClaimModal}><PlusCircle className="mr-2 h-4 w-4" /> New Claim</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Filter className="mr-2 h-5 w-5" /> Filters</CardTitle>
          <UiCardDescription>Refine the list of claims displayed below.</UiCardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="levelSelect">Level</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger id="levelSelect"><SelectValue /></SelectTrigger>
                <SelectContent>{claimLevelOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedLevel === "brand" && (
              <div>
                <Label htmlFor="brandFilterSelect">Brand (for Brand Level Claims)</Label>
                <Select value={selectedBrandFilter} onValueChange={setSelectedBrandFilter} disabled={globalClaimBrands.length === 0}>
                  <SelectTrigger id="brandFilterSelect"><SelectValue placeholder={globalClaimBrands.length > 0 ? "All Brands" : "No brands available"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {globalClaimBrands.map(brand => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedLevel === "product" && (
              <>
                <div>
                  <Label htmlFor="brandForProductFilterSelect">Brand (for Product)</Label>
                  <Select value={selectedBrandFilter} onValueChange={setSelectedBrandFilter} disabled={brands.length === 0}>
                    <SelectTrigger id="brandForProductFilterSelect"><SelectValue placeholder={brands.length > 0 ? "All Brands" : "No brands available"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {brands.map(brand => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="productFilterSelect">Product</Label>
                  <Select value={selectedProductFilter} onValueChange={setSelectedProductFilter} disabled={productsState.filter(p => selectedBrandFilter === 'all' || p.global_brand_id === selectedBrandFilter).length === 0}>
                    <SelectTrigger id="productFilterSelect"><SelectValue placeholder={productsState.filter(p => selectedBrandFilter === 'all' || p.global_brand_id === selectedBrandFilter).length > 0 ? "All Products" : "No products for selected brand"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      {productsState.filter(p => selectedBrandFilter === 'all' || p.global_brand_id === selectedBrandFilter).map(product => <SelectItem key={product.id} value={product.id}>{product.name} ({product.brand_name})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {selectedLevel === "ingredient" && (
              <div>
                <Label htmlFor="ingredientFilterSelect">Ingredient</Label>
                <Select value={selectedIngredientFilter} onValueChange={setSelectedIngredientFilter} disabled={ingredientsState.length === 0}>
                  <SelectTrigger id="ingredientFilterSelect"><SelectValue placeholder={ingredientsState.length > 0 ? "All Ingredients" : "No ingredients available"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ingredients</SelectItem>
                    {ingredientsState.map(ing => <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="countrySelect">Country Context</Label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger id="countrySelect"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value={CLAIM_COUNTRY_GLOBAL}>Global</SelectItem>
                  {COUNTRIES.map(country => <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="claimTypeSelect">Claim Type</Label>
              <Select value={selectedClaimType} onValueChange={setSelectedClaimType}>
                <SelectTrigger id="claimTypeSelect"><SelectValue /></SelectTrigger>
                <SelectContent>{claimTypeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="searchTermInput">Search Claims</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="searchTermInput" type="text" placeholder="Search by claim text or description..." value={searchTerm} onChange={handleSearchChange} className="pl-10" />
            </div>
          </div>
          {selectedLevel === 'brand' && (
            <div className="mt-4 pt-4 border-t">
              <Button onClick={handleOpenBrandAiReviewModal} variant="outline" disabled={!selectedBrandFilter || selectedBrandFilter === "all" || isLoadingBrandAiReview}>
                <Sparkles className="mr-2 h-4 w-4" /> Review All Claims for Selected Brand (AI)
                {isLoadingBrandAiReview && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Claims List</CardTitle>
          <UiCardDescription>{filteredClaims.length > 0 ? `Displaying ${filteredClaims.length} claim${filteredClaims.length === 1 ? '' : 's'}.` : "No claims match the current filters."}</UiCardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="flex flex-col items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-10 w-10 animate-spin mb-3" /><p>Loading claims...</p></div>}
          {!isLoading && error && <div className="flex flex-col items-center justify-center py-10 text-destructive"><AlertTriangle className="h-10 w-10 mb-3" /><p className="font-semibold">Error loading claims:</p><p>{error}</p><Button onClick={fetchClaims} variant="outline" className="mt-4">Try Again</Button></div>}
          {!isLoading && !error && filteredClaims.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3" /><p className="font-semibold">No Claims Found</p>
              <p className="text-center">No claims match your current filter criteria. <br /> Try adjusting your filters or create a new claim.</p>
              <Button onClick={handleOpenAddClaimModal} variant="outline" className="mt-6"><PlusCircle className="mr-2 h-4 w-4" /> Create New Claim</Button>
            </div>
          )}
          {!isLoading && !error && filteredClaims.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim Text</TableHead><TableHead>Level</TableHead><TableHead>Entity</TableHead>
                  <TableHead>Country</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium max-w-sm break-words">
                      {claim.claim_text}
                      {claim.description && (
                        <HelpCircle className="h-3 w-3 inline-block ml-1 text-muted-foreground cursor-help" />
                      )}
                    </TableCell>
                    <TableCell className="capitalize">
                      <span className="flex items-center">
                        {claim.level === 'brand' && <Building className="mr-1.5 h-4 w-4 text-sky-500 flex-shrink-0" />}
                        {claim.level === 'product' && <ProductIcon className="mr-1.5 h-4 w-4 text-purple-500 flex-shrink-0" />}
                        {claim.level === 'ingredient' && <Leaf className="mr-1.5 h-4 w-4 text-green-500 flex-shrink-0" />}
                        {claim.level}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getEntityName(claim)}
                      {claim.level === 'product' && <div className="text-xs text-muted-foreground">Brand: {getParentBrandNameForProduct(claim.product_id)}</div>}
                    </TableCell>
                    <TableCell>{claim.country_code === CLAIM_COUNTRY_GLOBAL ? "Global" : COUNTRIES.find(c => c.value === claim.country_code)?.label || claim.country_code}</TableCell>
                    <TableCell className="capitalize">{claim.claim_type}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="icon" title="Edit Claim" onClick={() => handleOpenEditClaimModal(claim)}><Edit className="h-4 w-4" /><span className="sr-only">Edit Claim</span></Button>
                        <Button variant="ghost" size="icon" title="Delete Claim" onClick={() => handleDeleteClaim(claim.id)} className="text-destructive hover:text-destructive/90"><Trash2 className="h-4 w-4" /><span className="sr-only">Delete Claim</span></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={showClaimModal} onOpenChange={setShowClaimModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingClaim ? "Edit Claim" : "Add New Claim"}</DialogTitle>
            <DialogDescription>{editingClaim ? "Update the details of this claim." : "Fill in the form below to create a new claim."}</DialogDescription>
          </DialogHeader>
          <AddEditClaimForm
              claimToEdit={editingClaim}
              brands={globalClaimBrands}
              products={productsState}
              ingredients={ingredientsState}
              onSave={handleSaveClaim}
              onCancel={() => setShowClaimModal(false)}
              globalClaimBrands={globalClaimBrands}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={showBrandAiReviewModal} onOpenChange={setShowBrandAiReviewModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center"><Sparkles className="mr-2 h-5 w-5 text-sky-500" />AI Review for Brand: {brands.find(b => b.id === selectedBrandForAiReview)?.name || 'Selected Brand'}</DialogTitle>
            <DialogDescription>This is an AI-generated analysis of all claims associated with this brand.</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {isLoadingBrandAiReview && <div className="flex items-center justify-center space-x-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><span>Generating AI analysis... This may take a moment.</span></div>}
            {brandAiReviewError && !isLoadingBrandAiReview && <div className="text-destructive p-4 border border-destructive/50 rounded-md"><AlertTriangle className="inline h-5 w-5 mr-2" />Error: {brandAiReviewError}</div>}
            {!isLoadingBrandAiReview && !brandAiReviewError && brandAiReviewContent && <div className="prose prose-sm max-w-none whitespace-pre-wrap">{brandAiReviewContent}</div>}
            {!isLoadingBrandAiReview && !brandAiReviewError && !brandAiReviewContent && <p className="text-muted-foreground">No AI analysis content available.</p>}
          </div>
          <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 