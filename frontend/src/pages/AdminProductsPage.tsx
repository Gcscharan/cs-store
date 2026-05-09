import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import {
  useUpdateProductMutation,
  useDeleteProductMutation,
} from "../store/api";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  ArrowLeft,
  Package,
  DollarSign,
  Hash,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import FileUpload from "../components/FileUpload";
import { getProductImage } from "../utils/image";
import { API_BASE_URL } from "../config/runtime";

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  mrp?: number;
  category: string;
  stock: number;
  weight?: number;
  images?: string[] | { full: string; thumb: string }[];
  createdAt: string;
  updatedAt: string;
}

const AdminProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const { tokens, isAuthenticated, user, loading } = useSelector(
    (state: RootState) => state.auth
  );
  const [updateProductMutation] = useUpdateProductMutation();
  const [deleteProductMutation] = useDeleteProductMutation();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    price: 0,
    mrp: 0,
    category: "",
    stock: 0,
    weight: 0,
    images: [] as { full: string; thumb: string }[],
  });

  // ── Bulk Upload State ──────────────────────────────────────────────────────
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check authentication
  useEffect(() => {
    if (loading) {
      return;
    }

    const isAdmin = !!(user?.isAdmin || user?.role === "admin");
    if (!isAuthenticated || !isAdmin) {
      navigate("/login", { replace: true });
      return;
    }
    fetchProducts();
  }, [loading, isAuthenticated, user, navigate]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/products`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error response:", errorData);

        // Handle token expiration
        if (response.status === 401 || response.status === 403) {
          // Clear invalid auth data and redirect to login
          localStorage.removeItem("auth");
          navigate("/login", { replace: true });
          return;
        }

        throw new Error(errorData.error || "Failed to fetch products");
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error("Error fetching products:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load products. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      await deleteProductMutation(productId).unwrap();
      setProducts(products.filter((p) => p._id !== productId));
    } catch (err) {
      console.error("Error deleting product:", err);
      alert("Failed to delete product. Please try again.");
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    
    // Convert images to dual-resolution format
    let convertedImages: { full: string; thumb: string }[] = [];
    
    if (product.images && product.images.length > 0) {
      if (typeof product.images[0] === 'string') {
        // Old format: string[] - convert to dual-resolution
        convertedImages = product.images.map(img => ({
          full: img as string,
          thumb: img as string // Use same image for both full and thumb
        }));
      } else {
        // New format: already dual-resolution
        convertedImages = product.images as { full: string; thumb: string }[];
      }
    }
    
    setEditFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      mrp: product.mrp || 0,
      category: product.category,
      stock: product.stock,
      weight: product.weight || 0,
      images: convertedImages,
    });
    setShowEditModal(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      await updateProductMutation({
        id: editingProduct._id,
        ...editFormData,
        images: editFormData.images,
      }).unwrap();

      // Refresh products list
      fetchProducts();
      setShowEditModal(false);
      setEditingProduct(null);
      setEditFormData({
        name: "",
        description: "",
        price: 0,
        mrp: 0,
        category: "",
        stock: 0,
        weight: 0,
        images: [],
      });
    } catch (error) {
      console.error("Error updating product:", error);
      alert("Failed to update product. Please try again.");
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingProduct(null);
    setEditFormData({
      name: "",
      description: "",
      price: 0,
      mrp: 0,
      category: "",
      stock: 0,
      weight: 0,
      images: [],
    });
  };

  // ── Bulk Upload Handlers ───────────────────────────────────────────────────
  const REQUIRED_COLS = ['name', 'price', 'category', 'stock'];

  const parseCsvRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);
    setBulkErrors([]);
    setBulkResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { setBulkErrors(['CSV must have a header row and at least one data row.']); return; }

      const headers = parseCsvRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
      const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
      if (missing.length) { setBulkErrors([`Missing required columns: ${missing.join(', ')}`]); return; }

      const rows: any[] = [];
      const errs: string[] = [];
      for (let i = 1; i < Math.min(lines.length, 201); i++) {
        const vals = parseCsvRow(lines[i]);
        const row: any = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
        if (!row.name) { errs.push(`Row ${i}: name is required`); continue; }
        if (isNaN(Number(row.price)) || Number(row.price) <= 0) { errs.push(`Row ${i}: price must be a positive number`); continue; }
        if (!row.category) { errs.push(`Row ${i}: category is required`); continue; }
        row.price = Number(row.price);
        row.mrp = row.mrp ? Number(row.mrp) : undefined;
        row.stock = row.stock ? Number(row.stock) : 0;
        row.weight = row.weight ? Number(row.weight) : undefined;
        rows.push(row);
      }
      setBulkErrors(errs);
      setBulkPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile || !tokens?.accessToken) return;
    setIsBulkUploading(true);
    setBulkResult(null);
    try {
      const reader = new FileReader();
      const text = await new Promise<string>((res) => {
        reader.onload = (e) => res(e.target?.result as string);
        reader.readAsText(bulkFile);
      });
      const lines = text.split('\n').filter(l => l.trim());
      const headers = parseCsvRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
      const products: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = parseCsvRow(lines[i]);
        const row: any = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
        if (!row.name || !row.price || !row.category) continue;
        products.push({
          name: row.name,
          description: row.description || '',
          price: Number(row.price),
          mrp: row.mrp ? Number(row.mrp) : undefined,
          category: row.category,
          stock: row.stock ? Number(row.stock) : 0,
          weight: row.weight ? Number(row.weight) : undefined,
        });
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({ products }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Bulk upload failed');
      setBulkResult({ created: data.created || products.length, failed: data.failed || 0 });
      fetchProducts();
    } catch (err: any) {
      setBulkErrors([err.message || 'Upload failed']);
    } finally {
      setIsBulkUploading(false);
    }
  };

  const downloadCsvTemplate = () => {
    const csv = 'name,description,price,mrp,category,stock,weight\nSample Product,A great product,99,149,Groceries,100,500\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'products-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={() => navigate("/admin")}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Products Management
              </h1>
              <p className="text-gray-600">Manage your product catalog</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => navigate("/admin/products/new")}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </button>
            <button
              onClick={() => { setShowBulkModal(true); setBulkResult(null); setBulkErrors([]); setBulkPreview([]); setBulkFile(null); }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Bulk Upload
            </button>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {error ? (
            <div className="text-center py-12">
              <div className="text-red-500 text-lg font-medium mb-2">
                Error Loading Products
              </div>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="space-x-3">
                <button
                  onClick={fetchProducts}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Try Again
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem("auth");
                    window.location.href = "/login";
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Login Again
                </button>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Products Found
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || selectedCategory
                  ? "No products match your current filters."
                  : "No products available. Add your first product to get started."}
              </p>
              <button
                onClick={() => navigate("/admin/products/new")}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Weight
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <tr key={product._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-12 w-12">
                            {getProductImage(product) ? (
                              <img
                                className="h-12 w-12 rounded-lg object-cover"
                                src={getProductImage(product)}
                                alt={product.name}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-gray-200 flex items-center justify-center">
                                <Package className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {product.name}
                            </div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {product.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <div className="flex items-center space-x-2">
                            {product.mrp && product.mrp > 0 && (
                              <span className="text-gray-500 line-through text-xs">
                                ₹{product.mrp.toLocaleString()}
                              </span>
                            )}
                            <span className="font-semibold">
                              ₹{product.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            product.stock > 10
                              ? "bg-green-100 text-green-800"
                              : product.stock > 0
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {product.stock} units
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.weight ? `${product.weight}g` : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product._id)}
                            className="text-red-600 hover:text-red-900 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Hash className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Total Products
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {products.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">In Stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {products.filter((p) => p.stock > 0).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Categories</p>
                <p className="text-2xl font-bold text-gray-900">
                  {categories.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Upload Modal */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Bulk Upload Products</h3>
                <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>

              {/* Template download */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Download CSV Template</p>
                  <p className="text-xs text-blue-600">Required columns: name, price, category, stock</p>
                </div>
                <button onClick={downloadCsvTemplate} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium">
                  <Download className="h-4 w-4" /> Template
                </button>
              </div>

              {/* File input */}
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">{bulkFile ? bulkFile.name : 'Click to select CSV file (max 200 products)'}</p>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleBulkFileChange} />
              </div>

              {/* Errors */}
              {bulkErrors.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-1 mb-1"><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-sm font-medium text-red-700">Validation errors</span></div>
                  {bulkErrors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-red-600">• {e}</p>)}
                  {bulkErrors.length > 5 && <p className="text-xs text-red-500">...and {bulkErrors.length - 5} more</p>}
                </div>
              )}

              {/* Preview */}
              {bulkPreview.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview (first {bulkPreview.length} rows)</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border border-gray-200 rounded">
                      <thead className="bg-gray-50"><tr>{['name','price','category','stock'].map(h => <th key={h} className="px-2 py-1 text-left font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                      <tbody>{bulkPreview.map((row, i) => <tr key={i} className="border-t"><td className="px-2 py-1">{row.name}</td><td className="px-2 py-1">₹{row.price}</td><td className="px-2 py-1">{row.category}</td><td className="px-2 py-1">{row.stock}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Result */}
              {bulkResult && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-green-700 font-medium">{bulkResult.created} products created{bulkResult.failed > 0 ? `, ${bulkResult.failed} failed` : ''}.</span>
                </div>
              )}

              <div className="mt-4 flex justify-end gap-3">
                <button onClick={() => setShowBulkModal(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
                <button
                  onClick={handleBulkUpload}
                  disabled={!bulkFile || bulkErrors.length > 0 || isBulkUploading}
                  className="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isBulkUploading ? <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />Uploading...</> : <><Upload className="h-4 w-4" />Upload Products</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Product Modal */}
        {showEditModal && editingProduct && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Edit Product
                  </h3>
                  <button
                    onClick={handleCancelEdit}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleUpdateProduct} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name
                    </label>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={editFormData.description}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        MRP (₹)
                      </label>
                      <input
                        type="number"
                        value={editFormData.mrp}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            mrp: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Maximum Retail Price"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Selling Price (₹)
                      </label>
                      <input
                        type="number"
                        value={editFormData.price}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            price: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stock
                      </label>
                      <input
                        type="number"
                        value={editFormData.stock}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            stock: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        value={editFormData.category}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            category: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Weight (g)
                      </label>
                      <input
                        type="number"
                        value={editFormData.weight}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            weight: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Images
                    </label>
                    <FileUpload
                      images={editFormData.images}
                      onChange={(images) =>
                        setEditFormData({
                          ...editFormData,
                          images,
                        })
                      }
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Update Product
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProductsPage;
