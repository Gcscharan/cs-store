import React from "react";
import { useNavigate } from "react-router-dom";

interface Product {
  _id: string;
  name: string;
  image: string;
  category: string;
  price: number;
}

interface SearchSuggestionsProps {
  suggestions: Product[];
  searchQuery: string;
  onClose: () => void;
  isLoading?: boolean;
}

const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  suggestions,
  searchQuery,
  onClose,
  isLoading = false,
}) => {
  const navigate = useNavigate();

  const handleSuggestionClick = (productId: string) => {
    navigate(`/product/${productId}`);
    onClose();
  };

  // Don't render if no search query
  if (!searchQuery || searchQuery.length < 1) {
    return null;
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-md shadow-lg z-50 overflow-hidden">
      {isLoading ? (
        <div className="px-4 py-8 text-center text-gray-500">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm">Searching...</p>
        </div>
      ) : suggestions.length > 0 ? (
        <>
          {suggestions.map((product) => (
            <div
              key={product._id}
              onClick={() => handleSuggestionClick(product._id)}
              className="flex items-center px-4 py-2.5 hover:bg-gray-100 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="w-10 h-10 flex-shrink-0 mr-3">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src =
                      "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop&crop=center";
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 truncate">
                  {product.name}
                </div>
                <div className="text-xs text-blue-600 mt-0.5">
                  in {product.category}
                </div>
              </div>
              <div className="text-sm font-medium text-gray-700 ml-2">
                ₹{product.price}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="px-4 py-8 text-center text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="mt-2 text-sm font-medium">No suggestions found</p>
          <p className="mt-1 text-xs">Try searching with different keywords</p>
        </div>
      )}
    </div>
  );
};

export default SearchSuggestions;
