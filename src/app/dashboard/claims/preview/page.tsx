"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from "next/link";
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from '@/components/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Eye, 
  Loader2, 
  AlertTriangle, 
  Sparkles, 
  ChevronDown, 
  ChevronRight, 
  Building, 
  Package as ProductIcon, 
  Leaf,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText
} from 'lucide-react';
import { CLAIM_COUNTRY_GLOBAL, COUNTRIES } from '@/lib/constants';
import { StackedClaim } from '@/lib/claims-utils';

interface Product {
  id: string;
  name: string;
  global_brand_id: string | null;
  brand_name?: string;
}

interface Brand {
    id: string;
    name: string;
}

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

export default function ClaimsPreviewPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
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

  const toggleSection = (section: keyof typeof expandedSections) => {
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
        const brandsData = await brandsResponse.json();

        if (productsData.success && Array.isArray(productsData.data)) {
          const enrichedProducts = productsData.data.map((p: Product) => {
            if (p.brand_name) return p;
            const productBrand = brandsData.success ? brandsData.data.find((b:Brand) => b.id === p.global_brand_id) : null;
            return { ...p, brand_name: productBrand?.name || 'Unknown Brand'};
          });
          setProducts(enrichedProducts);
        } else {
          toast.error('Failed to load products.', { description: productsData.error });
        }

        if (brandsData.success && Array.isArray(brandsData.data)) {
            setBrands(brandsData.data);
        } else {
            if (!productsData.success) toast.error('Failed to load brands for filter.', { description: brandsData.error });
        }

      } catch (err) {
        console.error("Error fetching products or brands:", err);
        toast.error('Error loading initial product and brand data.');
        setProducts([]);
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
          toast.info("No claims found for the selected product and country combination.");
        }
      } else {
        throw new Error(data.error || 'Unknown error fetching stacked claims');
      }
    } catch (err: any) {
      console.error("Error fetching stacked claims:", err);
      setError(err.message || 'An unexpected error occurred.');
      toast.error('Failed to load claims preview.', { description: err.message });
      setStackedClaims([]);
    } finally {
      setIsLoadingClaims(false);
    }
  }, [selectedProductId, selectedCountryCode]);
  
  const fetchAiAnalysis = async (claimsToAnalyze: StackedClaim[]) => {
    setIsLoadingAiAnalysis(true);
    setAiAnalysisError(null);
    setAiAnalysis(null);
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
    return `${product.name} (${product.brand_name || 'Unknown Brand'})`;
  };

  const claimsByLevel = (level: StackedClaim['level']) => stackedClaims.filter(claim => claim.level === level);

  const breadcrumbItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/claims/manage", label: "Claims Management" },
    { label: "Claims Preview", isCurrent: true }
  ];
  
  const getClaimTypeIcon = (type: StackedClaim['claim_type']) => {
    switch (type) {
      case 'allowed': return <CheckCircle2 className="mr-1.5 h-4 w-4 text-green-500 flex-shrink-0" />;
      case 'disallowed': return <XCircle className="mr-1.5 h-4 w-4 text-red-500 flex-shrink-0" />;
      case 'mandatory': return <AlertCircle className="mr-1.5 h-4 w-4 text-yellow-500 flex-shrink-0" />;
      default: return null;
    }
  };

  const getClaimLevelIcon = (level: StackedClaim['level']) => {
    switch(level) {
      case 'brand': return <Building className="mr-1.5 h-4 w-4 text-sky-500 flex-shrink-0" />;
      case 'product': return <ProductIcon className="mr-1.5 h-4 w-4 text-purple-500 flex-shrink-0" />;
      case 'ingredient': return <Leaf className="mr-1.5 h-4 w-4 text-green-600 flex-shrink-0" />;
      default: return null;
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="space-y-1 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Claims Preview</h1>
        <p className="text-muted-foreground">
          Select a product and country to see the applicable stack of claims, including brand, product, and ingredient level claims, and an AI-powered analysis.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Eye className="mr-2 h-5 w-5" /> Select Product and Context
          </CardTitle>
          <UiCardDescription>
            Choose a product and the relevant country to generate the claims preview.
          </UiCardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="productSelect">Product*</Label>
              {isLoadingProducts ? (
                 <div className="flex items-center space-x-2 text-muted-foreground h-10 border border-input rounded-md px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> <span>Loading products...</span>
                </div>
              ) : (
                <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={products.length === 0}>
                  <SelectTrigger id="productSelect">
                    <SelectValue placeholder={products.length > 0 ? "Select a product" : "No products available"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {products.length === 0 && <SelectItem value="no-products" disabled>No products loaded</SelectItem>}
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.brand_name || 'Unknown Brand'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="countrySelect">Country Context*</Label>
              <Select value={selectedCountryCode} onValueChange={setSelectedCountryCode}>
                <SelectTrigger id="countrySelect">
                  <SelectValue placeholder="Select country" />
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
          <Button onClick={handlePreviewClaims} disabled={isLoadingClaims || !selectedProductId || isLoadingProducts} className="w-full md:w-auto mt-2">
            {isLoadingClaims ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Preview...</>
            ) : (
              <><Eye className="mr-2 h-4 w-4" /> Preview Claims</>
            )}
          </Button>
        </CardContent>
      </Card>

      {isLoadingClaims && (
        <Card>
          <CardContent className="py-10 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin mb-3" />
            <p>Generating claims preview...</p>
          </CardContent>
        </Card>
      )}

      {error && !isLoadingClaims && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" /> Error Loading Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button onClick={handlePreviewClaims} variant="secondary" className="mt-4">Try Again</Button>
          </CardContent>
        </Card>
      )}
      
      {!isLoadingClaims && !error && stackedClaims.length === 0 && selectedProductId && (
         <Card>
            <CardContent className="py-10 flex flex-col items-center justify-center text-muted-foreground">
                <FileText className="h-10 w-10 mb-3" />
                <p className="font-semibold">No Claims Found</p>
                <p>No claims are currently stacked for {getProductDisplayName(selectedProductId)} in {COUNTRIES.find(c=>c.value === selectedCountryCode)?.label || selectedCountryCode}.</p>
            </CardContent>
        </Card>
      )}

      {!isLoadingClaims && !error && stackedClaims.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Stacked Claims for: {getProductDisplayName(selectedProductId)}</CardTitle>
              <UiCardDescription>Context: {COUNTRIES.find(c=>c.value === selectedCountryCode)?.label || selectedCountryCode}. Claims are inherited from brand, product, and ingredient levels.</UiCardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(['brand', 'product', 'ingredient'] as StackedClaim['level'][]).map(level => {
                const claimsForLevel = claimsByLevel(level);
                if (claimsForLevel.length === 0 && level !== 'ingredient') return null;

                return (
                  <div key={level}>
                    <button onClick={() => toggleSection(level)} className="flex items-center justify-between w-full py-2 text-lg font-semibold">
                      <span className="flex items-center capitalize">
                        {getClaimLevelIcon(level)}
                        {level} Level Claims ({claimsForLevel.length})
                      </span>
                      {expandedSections[level] ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    {expandedSections[level] && (
                      <div className="space-y-3 pt-2 pl-2 border-l-2 border-muted ml-2">
                        {claimsForLevel.length > 0 ? claimsForLevel.map((claim, index) => (
                          <Card key={claim.id || index} className={`p-3 ${claim.claim_type === 'mandatory' ? 'border-l-4 border-yellow-500 bg-yellow-500/5' : ''}`}>
                            <div className="flex items-center text-sm text-muted-foreground mb-1">
                              {getClaimTypeIcon(claim.claim_type)}
                              <span className="capitalize mr-2">{claim.claim_type}</span>
                              <span className="mr-2">•</span> 
                              <span>Origin: {claim.origin_level || 'N/A'}</span>
                            </div>
                            <p className="font-medium text-sm text-foreground">{claim.claim_text}</p>
                            {claim.description && <p className="text-xs text-muted-foreground mt-1">{claim.description}</p>}
                          </Card>
                        )) : <p className="text-sm text-muted-foreground italic">No {level} level claims applicable.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {aiAnalysis || isLoadingAiAnalysis || aiAnalysisError ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><Sparkles className="mr-2 h-5 w-5 text-sky-500" />AI Analysis of Claims Stack</CardTitle>
                <UiCardDescription>An AI-generated summary and analysis of the currently displayed claims stack for the selected product and country.</UiCardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAiAnalysis && (
                  <div className="flex items-center justify-center space-x-2 text-muted-foreground py-6">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Generating AI analysis... This may take a moment.</span>
                  </div>
                )}
                {aiAnalysisError && !isLoadingAiAnalysis && (
                  <div className="text-destructive p-4 border border-destructive/50 rounded-md bg-destructive/5">
                    <div className="flex items-center font-medium mb-1"><AlertTriangle className="inline h-5 w-5 mr-2" />AI Analysis Error:</div>
                    <p className="text-sm">{aiAnalysisError}</p>
                    <Button variant="link" onClick={() => fetchAiAnalysis(stackedClaims)} className="p-0 h-auto mt-1 text-sm">Try again</Button>
                  </div>
                )}
                {!isLoadingAiAnalysis && !aiAnalysisError && aiAnalysis && (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap p-2 bg-muted/30 rounded-md">{aiAnalysis}</div>
                )}
                {!isLoadingAiAnalysis && !aiAnalysisError && !aiAnalysis && stackedClaims.length > 0 && (
                    <p className="text-muted-foreground text-sm py-4 text-center">AI analysis could not be generated or is not available.</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
} 