"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/table";
import { PlusCircle, Edit, Trash2, PackageOpen, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/input";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // For brand filter if needed

// Define interfaces based on expected API response (matching stubs)
interface Product {
  id: string;
  name: string;
  description?: string | null;
  brand_id: string; // In a real scenario, you might fetch brand name too
  created_at: string;
  // Add other fields as necessary
}

// Mock user data - replace with actual user context/hook later
// const mockUser = { id: 'user123', role: 'admin',品牌: ['brand_x_123'] }; // example

export default function ClaimsProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  // const [selectedBrand, setSelectedBrand] = useState<string>("all"); // For brand filter
  // const [userBrands, setUserBrands] = useState<{id: string, name: string}[]>([]); // For brand filter dropdown

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      try {
        // TODO: Adjust API call based on user role for brand filtering if necessary
        // e.g., pass brand_id if user is Brand Admin, or allow Global Admin to select
        const response = await fetch("/api/products"); 
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to fetch products" }));
          throw new Error(errorData.error || "Failed to fetch products");
        }
        const data = await response.json();
        if (data.success) {
          setProducts(Array.isArray(data.data) ? data.data : []);
        } else {
          throw new Error(data.error || "Unknown error fetching products");
        }
      } catch (err: any) {
        console.error("Error fetching products:", err);
        setError(err.message || "An unexpected error occurred.");
        toast.error("Failed to load products.", { description: err.message });
      } finally {
        setIsLoading(false);
      }
    }
    fetchProducts();
  }, []); // Dependency array might include selectedBrand for refetching

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description || "").toLowerCase().includes(searchTerm.toLowerCase())
    // Add brand filtering logic here if selectedBrand is used
  );

  const handleDeleteProduct = async (productId: string) => {
    // TODO: Implement actual delete functionality with confirmation
    toast.info(`Delete action for product ${productId} (not implemented yet).`);
    // Example:
    // if (!confirm("Are you sure you want to delete this product?")) return;
    // try {
    //   const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    //   // handle response
    // } catch (err) { ... }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <PackageOpen className="h-12 w-12 animate-pulse text-muted-foreground" />
        <p className="ml-4 text-muted-foreground">Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p className="text-xl font-semibold">Error loading products</p>
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products for Claims</h1>
          <p className="text-muted-foreground">
            Manage products that can have claims associated with them.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/claims/products/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product List</CardTitle>
          <div className="mt-4 flex flex-col md:flex-row gap-2 items-center">
            <div className="relative w-full md:flex-grow">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products by name or description..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-8 w-full"
              />
            </div>
            {/* TODO: Add Brand Filter Select for Global Admins */}
            {/* Example:
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {userBrands.map(brand => (
                  <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                ))}
              </SelectContent>
            </Select> 
            */}
          </div>
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <PackageOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Products Found</h3>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? "No products match your search criteria."
                  : "There are no products to display. Try adding a new one!"}
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
                    <TableHead>Brand ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm truncate max-w-xs">
                        {product.description || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{product.brand_id}</TableCell>
                      <TableCell className="text-right">
                        {/* <Button variant="ghost" size="icon" asChild>
                          <Link href={`/dashboard/claims/products/${product.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button> */}
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(product.id)} title="Delete (Stubbed)">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {/* TODO: Add View Details/Claims button? */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 