import { useState } from "react";
import FileUpload from "./FileUpload";

interface ProductFormProps {
  onImagesChange: (images: Array<{ full: string; thumb: string }>) => void;
  initialData?: any;
  isLoading?: boolean;
}

const ProductForm = ({
  onImagesChange,
  initialData,
  isLoading: _isLoading = false,
}: ProductFormProps) => {
  const [images, setImages] = useState<Array<{ full: string; thumb: string }>>(
    initialData?.images || []
  );

  const handleImagesChange = (newImages: Array<{ full: string; thumb: string }>) => {
    setImages(newImages);
    onImagesChange(newImages);
  };

  return (
    <div className="space-y-6">
      {/* Images Section Only */}
      <div className="space-y-6">
        {/* Drag & Drop Upload */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-4">
            Product Images
          </label>
          <FileUpload
            images={images}
            onChange={handleImagesChange}
          />
        </div>

        {/* Image Preview Grid */}
        {images.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Uploaded Images ({images.length}/5)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {images.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image.thumb}
                    alt={`Product Image ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border border-gray-200"
                  />
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductForm;
