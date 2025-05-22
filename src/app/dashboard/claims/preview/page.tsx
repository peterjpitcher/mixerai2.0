"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, Loader2, AlertTriangle, Sparkles, Info, ChevronDown, ChevronRight, Building, Package as ProductIcon, Leaf } from 'lucide-react';
import { CLAIM_COUNTRY_GLOBAL, COUNTRIES } from '@/lib/constants';
import { StackedClaim } from '@/lib/claims-utils'; // Assuming StackedClaim is exported from here

interface Product {
  id: string;
  name: string;
  brand_id: string; 
}

interface Brand {
    id: string;
    name: string;
}

export default function ClaimsPreviewPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]); // To display brand name with product
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(CLAIM_COUNTRY_GLOBAL);
  const [stackedClaims, setStackedClaims] = useState<StackedClaim[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAiAnalysis, setIsLoadingAiAnalysis] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    brand: true,
    product: true,
    ingredient: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    async function fetchProductsAndBrands() {
      setIsLoadingProducts(true);
      try {
        const [productsResponse, brandsResponse] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/brands')
        ]);

        const productsData = await productsResponse.json();
        if (productsData.success && Array.isArray(productsData.data)) {
          setProducts(productsData.data);
        } else {
          toast.error('Failed to load products.', { description: productsData.error });
        }

        const brandsData = await brandsResponse.json();
        if (brandsData.success && Array.isArray(brandsData.brands)) {
            setBrands(brandsData.brands);
        } else {
            toast.error('Failed to load brands.', { description: brandsData.error });
        }

      } catch (err) {
        console.error("Error fetching products or brands:", err);
        toast.error('Error loading initial data.');
      }
      setIsLoadingProducts(false);
    }
    fetchProductsAndBrands();
  }, []);

  const handlePreviewClaims = useCallback(async () => {
    if (!selectedProductId) {
      toast.info('Please select a product to preview claims.');
      setStackedClaims([]);
      return;
    }
    setIsLoadingClaims(true);
    setError(null);
    setStackedClaims([]);
    setAiAnalysis(null);
    setIsLoadingAiAnalysis(false);
    setAiAnalysisError(null);

    try {
      const params = new URLSearchParams({
        productId: selectedProductId,
        countryCode: selectedCountryCode,
      });
      const response = await fetch(`/api/claims/preview?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch stacked claims' }));
        throw new Error(errorData.error || 'Failed to fetch stacked claims');
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setStackedClaims(data.data);
        if (data.data.length > 0) {
          fetchAiAnalysis(data.data);
        } else {
          setAiAnalysis(null);
        }
      } else {
        throw new Error(data.error || 'Unknown error fetching stacked claims');
      }
    } catch (err: any) {
      console.error("Error fetching stacked claims:", err);
      setError(err.message || 'An unexpected error occurred.');
      toast.error('Failed to load claims preview.', { description: err.message });
    } finally {
      setIsLoadingClaims(false);
    }
  }, [selectedProductId, selectedCountryCode]);
  
  const fetchAiAnalysis = async (claimsToAnalyze: StackedClaim[]) => {
    setIsLoadingAiAnalysis(true);
    setAiAnalysisError(null);
    try {
      const response = await fetch('/api/ai/analyze-claims-stack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claims: claimsToAnalyze }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setAiAnalysis(result.analysis);
      } else {
        throw new Error(result.error || 'Failed to get AI analysis.');
      }
    } catch (err: any) {
      console.error("Error fetching AI analysis:", err);
      setAiAnalysisError(err.message || 'An unexpected error occurred during AI analysis.');
      toast.error('Failed to load AI analysis.', { description: err.message });
    } finally {
      setIsLoadingAiAnalysis(false);
    }
  };

  const getProductDisplayName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return productId;
    const brand = brands.find(b => b.id === product.brand_id);
    return `${product.name} (${brand?.name || 'Unknown Brand'})`;
  };

  const claimsByLevel = (level: StackedClaim['level']) => stackedClaims.filter(claim => claim.level === level);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Eye className="mr-2 h-6 w-6" /> Claims Preview
          </CardTitle>
          <CardDescription>
            Select a product and country to see the applicable stack of claims.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="productSelect">Product</Label>
              {isLoadingProducts ? (
                 <div className="flex items-center space-x-2 text-muted-foreground h-10">
                    <Loader2 className="h-4 w-4 animate-spin" /> <span>Loading products...</span>
                </div>
              ) : (
                <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={products.length === 0}>
                  <SelectTrigger id="productSelect">
                    <SelectValue placeholder={products.length > 0 ? "Select a product" : "No products available"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {getProductDisplayName(product.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="countrySelect">Country Context</Label>
              <Select value={selectedCountryCode} onValueChange={setSelectedCountryCode}>
                <SelectTrigger id="countrySelect">
                  <SelectValue placeholder="Select country context" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value={CLAIM_COUNTRY_GLOBAL}>Global</SelectItem>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.value} value={country.value}>
                      {country.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
          </div>
          <Button onClick={handlePreviewClaims} disabled={isLoadingClaims || !selectedProductId} className="w-full md:w-auto">
            {isLoadingClaims ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Preview...</>
            ) : (
              <><Eye className="mr-2 h-4 w-4" /> Preview Claims</>
            )}
          </Button>
        </CardContent>
      </Card>

      {isLoadingClaims && (
        <div className="text-center py-10">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Generating claims preview...</p>
        </div>
      )}

      {error && !isLoadingClaims && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" /> Error Loading Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={handlePreviewClaims} variant="outline" className="mt-4">Try Again</Button>
          </CardContent>
        </Card>
      )}

      {!isLoadingClaims && !error && stackedClaims.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stacked Claims for: {getProductDisplayName(selectedProductId)}</CardTitle>
            <CardDescription>Context: {COUNTRIES.find(c=>c.value === selectedCountryCode)?.label || selectedCountryCode}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {['brand', 'product', 'ingredient'].map(level => {
              const claimsForLevel = claimsByLevel(level as StackedClaim['level']);
              if (claimsForLevel.length === 0) return null;
              return (
                <div key={level}>
                  <button 
                    onClick={() => toggleSection(level)} 
                    className="flex items-center justify-between w-full py-2 text-lg font-semibold text-left hover:bg-muted/50 rounded p-2"
                  >
                    <span className="flex items-center capitalize">
                      {level === 'brand' && <Building className="mr-2 h-5 w-5 text-sky-500" />}
                      {level === 'product' && <ProductIcon className="mr-2 h-5 w-5 text-purple-500" />}
                      {level === 'ingredient' && <Leaf className="mr-2 h-5 w-5 text-green-500" />}
                      {level} Claims ({claimsForLevel.length})
                    </span>
                    {expandedSections[level] ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                  {expandedSections[level] && (
                    <ul className="mt-2 space-y-2 pl-4 border-l-2 ml-2 border-muted-foreground/20">
                      {claimsForLevel.map(claim => (
                        <li key={claim.id} className="p-3 rounded-md bg-muted/30 border">
                          <p className="font-medium">{claim.claim_text}</p>
                          <div className="text-xs text-muted-foreground mt-1 space-x-2">
                            <span>Type: <span className="font-semibold capitalize">{claim.claim_type}</span></span>
                            <span>Origin: <span className="font-semibold">{claim.origin_level}</span></span>
                            {claim.level === 'ingredient' && claim.source_entity_id && 
                             <span>Source: <span className="font-semibold">Ingredient ID {claim.source_entity_id}</span></span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      
      {!isLoadingClaims && !error && selectedProductId && stackedClaims.length === 0 && (
         <Card>
            <CardHeader>
                <CardTitle>No Claims Found</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">No applicable claims were found for the selected product and country context.</p>
            </CardContent>
         </Card>
      )}

      {/* Placeholder for AI Analysis */}
      {!isLoadingClaims && !error && selectedProductId && (
        <Card className="mt-6 border-dashed border-sky-500">
          <CardHeader>
            <CardTitle className="flex items-center text-sky-600">
              <Sparkles className="mr-2 h-5 w-5" /> AI-Powered Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAiAnalysis && (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generating AI analysis...</span>
              </div>
            )}
            {aiAnalysisError && !isLoadingAiAnalysis && (
              <div className="text-destructive">
                <AlertTriangle className="inline h-5 w-5 mr-2" />
                Error loading AI analysis: {aiAnalysisError}
              </div>
            )}
            {!isLoadingAiAnalysis && !aiAnalysisError && aiAnalysis && (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {aiAnalysis}
              </div>
            )}
            {!isLoadingAiAnalysis && !aiAnalysisError && !aiAnalysis && stackedClaims.length > 0 && (
              <p className="text-muted-foreground">AI analysis will appear here once generated.</p>
            )}
            {!isLoadingAiAnalysis && !aiAnalysisError && !aiAnalysis && stackedClaims.length === 0 && selectedProductId && (
              <p className="text-muted-foreground">No claims to analyze.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 