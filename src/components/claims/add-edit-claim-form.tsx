"use client";

import { useState, useEffect, FormEvent, useCallback, useRef } from 'react';
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from 'lucide-react';
import { CLAIM_COUNTRY_GLOBAL, COUNTRIES } from '@/lib/constants';

// Interfaces (mirroring those in manage/page.tsx and API stubs)
interface Claim {
  id?: string; // Optional for new claims
  claim_text: string;
  claim_type: 'allowed' | 'disallowed' | 'mandatory';
  level: 'brand' | 'product' | 'ingredient';
  global_brand_id?: string | null; // Changed from brand_id
  product_id?: string | null;
  ingredient_id?: string | null;
  country_code: string;
  description?: string | null;
  // brand_id is no longer directly on the claim, it's global_brand_id for brand-level claims
}

interface Brand { id: string; name: string; }
interface Product { id: string; name: string; global_brand_id: string | null; }
interface Ingredient { id: string; name: string; }

const claimLevelOptions: { value: Claim['level'] | 'select'; label: string }[] = [
  { value: "select", label: "Select Level..." },
  { value: "brand", label: "Brand" },
  { value: "product", label: "Product" },
  { value: "ingredient", label: "Ingredient" },
];

const claimTypeOptions: { value: Claim['claim_type'] | 'select'; label: string }[] = [
  { value: "select", label: "Select Type..." },
  { value: "allowed", label: "Allowed" },
  { value: "disallowed", label: "Disallowed" },
  { value: "mandatory", label: "Mandatory" },
];

interface AddEditClaimFormProps {
  claimToEdit?: Claim | null;
  onSave: (claimData: Claim) => Promise<void>;
  onCancel: () => void;
  brands: Brand[];
  products: Product[];
  ingredients: Ingredient[];
  globalClaimBrands: Brand[]; // New prop
}

export function AddEditClaimForm({ 
  claimToEdit, 
  onSave, 
  onCancel,
  brands: initialBrands, // Renamed prop for clarity internally
  products: initialProducts,
  ingredients: initialIngredients,
  globalClaimBrands
}: AddEditClaimFormProps) {
  const [claimText, setClaimText] = useState('');
  const [claimType, setClaimType] = useState<Claim['claim_type'] | 'select'>('select');
  const [level, setLevel] = useState<Claim['level'] | 'select'>('select');
  const [selectedBrandId, setSelectedBrandId] = useState<string>(''); // For product level, this is the parent brand. For brand level, this is the global_brand_id itself.
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  const [countryCode, setCountryCode] = useState<string>(CLAIM_COUNTRY_GLOBAL);
  const [description, setDescription] = useState('');
  const prevLevelRef = useRef<Claim['level'] | 'select'>('select');

  // Use props directly, no need for local state for these lists
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (claimToEdit) {
      setClaimText(claimToEdit.claim_text);
      setClaimType(claimToEdit.claim_type);
      setLevel(claimToEdit.level);
      // When editing, if it's a brand-level claim, selectedBrandId should be its global_brand_id.
      // If it's a product-level claim, selectedBrandId should be the product's parent brand (global_brand_id from product table).
      if (claimToEdit.level === 'brand') {
        setSelectedBrandId(claimToEdit.global_brand_id || '');
      } else if (claimToEdit.level === 'product' && claimToEdit.product_id) {
        const productDetails = initialProducts.find(p => p.id === claimToEdit.product_id);
        setSelectedBrandId(productDetails?.global_brand_id || '');
      } else {
        setSelectedBrandId('');
      }
      setSelectedProductId(claimToEdit.product_id || '');
      setSelectedIngredientId(claimToEdit.ingredient_id || '');
      setCountryCode(claimToEdit.country_code || CLAIM_COUNTRY_GLOBAL);
      setDescription(claimToEdit.description || '');
    } else {
      // Reset for new form
      setClaimText('');
      setClaimType('select');
      setLevel('select');
      setSelectedBrandId('');
      setSelectedProductId('');
      setSelectedIngredientId('');
      setCountryCode(CLAIM_COUNTRY_GLOBAL);
      setDescription('');
    }
  }, [claimToEdit, initialProducts]);

  useEffect(() => {
    if (level === 'product' && selectedBrandId) {
      setFilteredProducts(initialProducts.filter(p => p.global_brand_id === selectedBrandId));
    } else if (level !== 'product') { // Clear if not product level
      setFilteredProducts([]); 
    }

    if (level !== 'product') setSelectedProductId('');
    if (level !== 'ingredient') setSelectedIngredientId('');
    
    // If level changes FROM 'brand' (where selectedBrandId was the global_brand_id of the claim) 
    // TO something else, clear selectedBrandId. Also if changing TO 'ingredient'.
    if ((prevLevelRef.current === 'brand' && level !== 'brand') || level === 'ingredient') {
        setSelectedBrandId(''); 
    }

    prevLevelRef.current = level;
  }, [selectedBrandId, initialProducts, level]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (level === 'select') { toast.error('Please select a Claim Level.'); return; }
    if (claimType === 'select') { toast.error('Please select a Claim Type.'); return; }
    if (!claimText.trim()) { toast.error('Please enter Claim Text.'); return; }
    if (level === 'brand' && !selectedBrandId) { toast.error('Please select a Global Brand for a brand-level claim.'); return; }
    if (level === 'product' && !selectedProductId) { toast.error('Please select a Product for a product-level claim.'); return; }
    if (level === 'product' && !selectedBrandId) { toast.error('Please select the parent Brand for the product-level claim.'); return; } // Ensure parent brand for product is selected
    if (level === 'ingredient' && !selectedIngredientId) { toast.error('Please select an Ingredient for an ingredient-level claim.'); return; }

    setIsSubmitting(true);
    const claimData: Claim = {
      ...(claimToEdit && { id: claimToEdit.id }),
      claim_text: claimText,
      claim_type: claimType as Claim['claim_type'], 
      level: level as Claim['level'],
      global_brand_id: level === 'brand' ? selectedBrandId : null, // For brand level, selectedBrandId is the global_brand_id
      product_id: level === 'product' ? selectedProductId : null,
      // For product level, we don't store its parent brand_id directly on the claim in DB, it's on the product itself.
      ingredient_id: level === 'ingredient' ? selectedIngredientId : null,
      country_code: countryCode,
      description: description.trim() || null,
    };
    try {
      await onSave(claimData);
      toast.success(claimToEdit ? "Claim updated successfully!" : "Claim created successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to save claim.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoadingAnyData = false; // Data is now passed via props, parent handles loading.

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-2">
      <div>
        <Label htmlFor="claimLevel">Claim Level*</Label>
        <Select value={level} onValueChange={(value) => setLevel(value as Claim['level'] | 'select')} required aria-required="true">
          <SelectTrigger id="claimLevel"><SelectValue placeholder="Select Level..." /></SelectTrigger>
          <SelectContent>
            {claimLevelOptions.map(opt => <SelectItem key={opt.value} value={opt.value} disabled={opt.value === 'select'}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {level === 'brand' && (
        <div>
          <Label htmlFor="claimGlobalBrand">Global Brand* (for brand-level claim)</Label>
          <Select value={selectedBrandId} onValueChange={setSelectedBrandId} required={level === 'brand'} aria-required={level === 'brand'}>
            <SelectTrigger id="claimGlobalBrand"><SelectValue placeholder={globalClaimBrands.length === 0 ? "No global brands available" : "Select Global Brand..."} /></SelectTrigger>
            <SelectContent>
              {globalClaimBrands.length === 0 && <SelectItem value="" disabled>No global brands loaded</SelectItem>}
              {globalClaimBrands.map(brand => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {level === 'product' && (
        <div className='space-y-4'>
            <div>
                <Label htmlFor="claimProductParentBrand">Parent Brand (of Product)*</Label>
                <Select value={selectedBrandId} onValueChange={(value) => {setSelectedBrandId(value); setSelectedProductId('');}} required={level === 'product'} aria-required={level === 'product'}>
                    <SelectTrigger id="claimProductParentBrand"><SelectValue placeholder={initialBrands.length === 0 ? "No brands available" : "Select Parent Brand..."} /></SelectTrigger>
                    <SelectContent>
                        {initialBrands.length === 0 && <SelectItem value="no_brands_avail" disabled>No brands available</SelectItem>}
                        {initialBrands.map(brand => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground mt-1">Select the brand this product belongs to.</p>
            </div>
            <div>
              <Label htmlFor="claimProduct">Product*</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId} required={level === 'product'} aria-required={level === 'product'} disabled={!selectedBrandId || filteredProducts.length === 0}>
                <SelectTrigger id="claimProduct"><SelectValue placeholder={!selectedBrandId ? "Select parent brand first" : (filteredProducts.length === 0 ? "No products for selected brand" : "Select Product...")} /></SelectTrigger>
                <SelectContent>
                  {!selectedBrandId && <SelectItem value="select_brand_first" disabled>Select parent brand first</SelectItem>}
                  {selectedBrandId && filteredProducts.length === 0 && <SelectItem value="no_prod_for_brand" disabled>No products for selected brand</SelectItem>}
                  {selectedBrandId && filteredProducts.map(prod => <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
        </div>
      )}

      {level === 'ingredient' && (
        <div>
          <Label htmlFor="claimIngredient">Ingredient*</Label>
          <Select value={selectedIngredientId} onValueChange={setSelectedIngredientId} required={level === 'ingredient'} aria-required={level === 'ingredient'}>
            <SelectTrigger id="claimIngredient"><SelectValue placeholder={initialIngredients.length === 0 ? "No ingredients available" : "Select Ingredient..."} /></SelectTrigger>
            <SelectContent>
              {initialIngredients.length === 0 && <SelectItem value="no_ingredients" disabled>No ingredients loaded</SelectItem>}
              {initialIngredients.map(ing => <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="claimText">Claim Text*</Label>
        <Textarea id="claimText" value={claimText} onChange={e => setClaimText(e.target.value)} placeholder="e.g., '100% Organic Cotton' or 'Reduces wrinkles by 50%'" required aria-required="true" rows={3}/>
      </div>

      <div>
        <Label htmlFor="claimType">Claim Type*</Label>
        <Select value={claimType} onValueChange={(value) => setClaimType(value as Claim['claim_type'] | 'select')} required aria-required="true">
          <SelectTrigger id="claimType"><SelectValue placeholder="Select Type..." /></SelectTrigger>
          <SelectContent>
            {claimTypeOptions.map(opt => <SelectItem key={opt.value} value={opt.value} disabled={opt.value === 'select'}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="countryCode">Country*</Label>
        <Select value={countryCode} onValueChange={setCountryCode} required aria-required="true">
          <SelectTrigger id="countryCode"><SelectValue placeholder="Select Country..." /></SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            <SelectItem value={CLAIM_COUNTRY_GLOBAL}>Global</SelectItem>
            {COUNTRIES.map(country => <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="claimDescription">Description (Optional)</Label>
        <Textarea id="claimDescription" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Further details or context for this claim." rows={3}/>
        <p className="text-xs text-muted-foreground mt-1">Provide any additional context or explanation for this claim. This is not typically public-facing.</p>
      </div>

      <div className="flex justify-end items-center gap-3 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            claimToEdit ? "Save Changes" : "Create Claim"
          )}
        </Button>
      </div>
    </form>
  );
} 