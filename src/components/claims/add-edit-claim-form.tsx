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
  brands: initialBrands, // Use props
  products: initialProducts, // Use props
  ingredients: initialIngredients, // Use props
  globalClaimBrands // Destructure new prop
}: AddEditClaimFormProps) {
  const [claimText, setClaimText] = useState('');
  const [claimType, setClaimType] = useState<Claim['claim_type'] | 'select'>('select');
  const [level, setLevel] = useState<Claim['level'] | 'select'>('select');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
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
      setSelectedBrandId(claimToEdit.level === 'brand' ? claimToEdit.global_brand_id || '' : '');
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
  }, [claimToEdit]);

  // Filter products when a global claim brand is selected for a product-level claim
  useEffect(() => {
    if (level === 'product' && selectedBrandId) {
      // Filter initialProducts by matching product.global_brand_id with selectedBrandId (which is a global_brand_id)
      setFilteredProducts(initialProducts.filter(p => p.global_brand_id === selectedBrandId));
    } else {
      // Simplified else to clear filteredProducts if not in product level or no brand selected
      setFilteredProducts([]); 
    }
     // When level changes, reset selections for other levels
    if (level !== 'product') {
        setSelectedProductId('');
    }
    // If level changes FROM 'brand' TO something else, clear selectedBrandId (as it was a global_brand_id)
    if (prevLevelRef.current === 'brand' && level !== 'brand') {
        setSelectedBrandId('');
    }
    // If level changes TO 'ingredient', clear selectedBrandId (as it's not used for filtering ingredients directly here)
    if (level === 'ingredient') {
        setSelectedBrandId(''); 
    }

    if (level !== 'ingredient') {
        setSelectedIngredientId('');
    }
    prevLevelRef.current = level; // Update previous level tracker
  }, [selectedBrandId, initialProducts, level]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (level === 'select' || claimType === 'select' || !claimText.trim()) {
      toast.error('Please fill in all required fields: Level, Type, and Claim Text.');
      return;
    }
    if (level === 'brand' && !selectedBrandId) {
      toast.error('Please select a Brand for a brand-level claim.');
      return;
    }
    if (level === 'product' && !selectedProductId) {
      toast.error('Please select a Product for a product-level claim.');
      return;
    }
    if (level === 'ingredient' && !selectedIngredientId) {
      toast.error('Please select an Ingredient for an ingredient-level claim.');
      return;
    }

    setIsSubmitting(true);
    const claimData: Claim = {
      ...(claimToEdit && { id: claimToEdit.id }),
      claim_text: claimText,
      claim_type: claimType as Claim['claim_type'], // Cast as 'select' is ruled out
      level: level as Claim['level'], // Cast as 'select' is ruled out
      global_brand_id: level === 'brand' ? selectedBrandId : null,
      product_id: level === 'product' ? selectedProductId : null,
      ingredient_id: level === 'ingredient' ? selectedIngredientId : null,
      country_code: countryCode,
      description: description,
    };
    await onSave(claimData);
    setIsSubmitting(false);
  };

  const isLoadingAnyData = false; // Data is now passed via props, parent handles loading.

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="claimLevel">Claim Level*</Label>
        <Select value={level} onValueChange={(value) => setLevel(value as Claim['level'] | 'select')} required>
          <SelectTrigger id="claimLevel"><SelectValue placeholder="Select Level..." /></SelectTrigger>
          <SelectContent>
            {claimLevelOptions.map(opt => <SelectItem key={opt.value} value={opt.value} disabled={opt.value === 'select'}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {level === 'brand' && (
        <div>
          <Label htmlFor="claimGlobalBrand">Global Brand*</Label>
          <Select value={selectedBrandId} onValueChange={setSelectedBrandId} required={level === 'brand'}>
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
                <Label htmlFor="claimProductBrand">Filter by Global Brand (for Product)*</Label>
                <Select value={selectedBrandId} onValueChange={(value) => {setSelectedBrandId(value); setSelectedProductId('');}} required >
                    <SelectTrigger id="claimProductBrand"><SelectValue placeholder={globalClaimBrands.length === 0 ? "No global brands available" : "Select Global Brand to filter products..."} /></SelectTrigger>
                    <SelectContent>
                        {globalClaimBrands.length === 0 && <SelectItem value="no_global_brands" disabled>No global brands loaded</SelectItem>}
                        {globalClaimBrands.map(brand => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
              <Label htmlFor="claimProduct">Product*</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId} required={level === 'product'} disabled={!selectedBrandId && initialProducts.length > 0}>
                <SelectTrigger id="claimProduct"><SelectValue placeholder={!selectedBrandId ? "Select a brand first" : (filteredProducts.length === 0 ? "No products for brand" : "Select Product...")} /></SelectTrigger>
                <SelectContent>
                  {!selectedBrandId && <SelectItem value="select_brand_first" disabled>Select a brand first</SelectItem>}
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
          <Select value={selectedIngredientId} onValueChange={setSelectedIngredientId} required={level === 'ingredient'}>
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
        <Textarea id="claimText" value={claimText} onChange={e => setClaimText(e.target.value)} placeholder="e.g., 100% Organic Cotton" required rows={3}/>
      </div>

      <div>
        <Label htmlFor="claimType">Claim Type*</Label>
        <Select value={claimType} onValueChange={(value) => setClaimType(value as Claim['claim_type'] | 'select')} required>
          <SelectTrigger id="claimType"><SelectValue placeholder="Select Type..." /></SelectTrigger>
          <SelectContent>
            {claimTypeOptions.map(opt => <SelectItem key={opt.value} value={opt.value} disabled={opt.value === 'select'}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="countryCode">Country*</Label>
        <Select value={countryCode} onValueChange={setCountryCode} required>
          <SelectTrigger id="countryCode"><SelectValue placeholder="Select Country..." /></SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            <SelectItem value={CLAIM_COUNTRY_GLOBAL}>Global</SelectItem>
            {COUNTRIES.map(country => <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="claimDescription">Description (Optional)</Label>
        <Textarea id="claimDescription" value={description} onChange={e => setDescription(e.target.value)} placeholder="Internal notes or context for this claim" rows={3}/>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || isLoadingAnyData || level === 'select' || claimType === 'select'}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : (claimToEdit ? "Save Changes" : "Create Claim")}
        </Button>
      </div>
    </form>
  );
} 