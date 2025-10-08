import { motion } from "framer-motion";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { addToCart } from "../store/slices/cartSlice";
import { useNavigate } from "react-router-dom";

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    description: string;
    price: number;
    mrp?: number;
    images: string[];
    category: string;
    stock: number;
    ratings: {
      average: number;
      count: number;
    };
  };
}

const ProductCard = ({ product }: ProductCardProps) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(
      addToCart({
        id: product._id,
        productId: product._id,
        name: product.name,
        price: product.price,
        image: product.images[0],
        shopkeeperId: "default",
        shopkeeperName: "CPS Store",
      })
    );
  };

  const handleCardClick = () => {
    navigate(`/products/${product._id}`);
  };

  const discountPercentage = product.mrp
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
      onClick={handleCardClick}
    >
      {/* Product Image */}
      <div className="relative h-48 bg-gray-100">
        {!imageError && product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <div className="text-4xl">📦</div>
          </div>
        )}

        {/* Discount Badge */}
        {discountPercentage > 0 && (
          <div className="absolute top-2 left-2 bg-error-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
            {discountPercentage}% OFF
          </div>
        )}

        {/* Stock Badge */}
        {product.stock === 0 && (
          <div className="absolute top-2 right-2 bg-gray-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
            Out of Stock
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
          {product.name}
        </h3>

        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {product.description}
        </p>

        {/* Rating */}
        {product.ratings.count > 0 && (
          <div className="flex items-center mb-3">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className={`text-sm ${
                    i < Math.floor(product.ratings.average)
                      ? "text-yellow-400"
                      : "text-gray-300"
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="text-sm text-gray-600 ml-2">
              ({product.ratings.count})
            </span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold text-gray-900">
              ₹{product.price}
            </span>
            {product.mrp && product.mrp > product.price && (
              <span className="text-sm text-gray-500 line-through">
                ₹{product.mrp}
              </span>
            )}
          </div>
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
            product.stock === 0
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-primary-600 text-white hover:bg-primary-700"
          }`}
        >
          {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
        </button>
      </div>
    </motion.div>
  );
};

export default ProductCard;
