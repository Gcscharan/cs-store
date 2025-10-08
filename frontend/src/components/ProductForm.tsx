import { useState } from "react";
import { motion } from "framer-motion";
import FileUpload from "./FileUpload";
import toast from "react-hot-toast";

interface ProductFormProps {
  onSubmit: (productData: any) => void;
  initialData?: any;
  isLoading?: boolean;
}

const ProductForm = ({
  onSubmit,
  initialData,
  isLoading = false,
}: ProductFormProps) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    category: initialData?.category || "",
    price: initialData?.price || "",
    mrp: initialData?.mrp || "",
    stock: initialData?.stock || "",
    sku: initialData?.sku || "",
    tags: initialData?.tags?.join(", ") || "",
    images: initialData?.images || [],
  });

  const [uploadedImages, setUploadedImages] = useState<string[]>(
    formData.images
  );

  const categories = [
    "groceries",
    "vegetables",
    "fruits",
    "dairy",
    "meat",
    "beverages",
    "snacks",
    "household",
    "personal_care",
    "medicines",
    "electronics",
    "clothing",
    "other",
  ];

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageUpload = (urls: string[]) => {
    setUploadedImages((prev) => [...prev, ...urls]);
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name ||
      !formData.description ||
      !formData.category ||
      !formData.price
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (uploadedImages.length === 0) {
      toast.error("Please upload at least one image");
      return;
    }

    const productData = {
      ...formData,
      price: parseFloat(formData.price),
      mrp: formData.mrp ? parseFloat(formData.mrp) : undefined,
      stock: parseInt(formData.stock),
      tags: formData.tags
        ? formData.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag)
        : [],
      images: uploadedImages,
    };

    onSubmit(productData);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Basic Information */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Basic Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Product Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="input"
              placeholder="Enter product name"
              required
            />
          </div>

          <div>
            <label className="label">SKU</label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleInputChange}
              className="input"
              placeholder="Product SKU (optional)"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="input min-h-[100px] resize-none"
              placeholder="Enter product description"
              required
            />
          </div>

          <div>
            <label className="label">Category *</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="input"
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() +
                    category.slice(1).replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Tags</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              className="input"
              placeholder="tag1, tag2, tag3"
            />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Price (₹) *</label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              className="input"
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="label">MRP (₹)</label>
            <input
              type="number"
              name="mrp"
              value={formData.mrp}
              onChange={handleInputChange}
              className="input"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="label">Stock Quantity *</label>
            <input
              type="number"
              name="stock"
              value={formData.stock}
              onChange={handleInputChange}
              className="input"
              placeholder="0"
              min="0"
              required
            />
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Product Images
        </h3>

        <FileUpload
          onUpload={handleImageUpload}
          multiple={true}
          maxFiles={5}
          maxSize={5}
          folder="products"
          className="mb-4"
        />

        {/* Image Preview */}
        {uploadedImages.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900">
              Uploaded Images:
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {uploadedImages.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Product ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end space-x-4">
        <button
          type="button"
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Saving..." : "Save Product"}
        </button>
      </div>
    </motion.form>
  );
};

export default ProductForm;
