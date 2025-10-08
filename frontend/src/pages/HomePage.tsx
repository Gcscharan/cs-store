import { motion } from "framer-motion";
import { useGetProductsQuery } from "../store/api";
import ProductCard from "../components/ProductCard";
import { useState } from "react";

const HomePage = () => {
  const [selectedCategory, setSelectedCategory] = useState("");
  const { data: productsData, isLoading } = useGetProductsQuery({
    category: selectedCategory,
    limit: 20,
  });

  const categories = [
    { id: "", name: "All", icon: "🛍️" },
    { id: "groceries", name: "Groceries", icon: "🛒" },
    { id: "vegetables", name: "Vegetables", icon: "🥬" },
    { id: "fruits", name: "Fruits", icon: "🍎" },
    { id: "dairy", name: "Dairy", icon: "🥛" },
    { id: "beverages", name: "Beverages", icon: "🥤" },
    { id: "snacks", name: "Snacks", icon: "🍿" },
    { id: "household", name: "Household", icon: "🏠" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-12 px-4"
      >
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">CPS Store</h1>
          <p className="text-xl md:text-2xl mb-8">
            Your Village Shopping Partner
          </p>
          <p className="text-lg opacity-90">
            Quality products delivered to your doorstep in Andhra Pradesh &
            Telangana
          </p>
        </div>
      </motion.div>

      {/* Categories */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-white py-6 px-4 shadow-sm"
      >
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`p-4 rounded-lg text-center transition-all duration-200 ${
                  selectedCategory === category.id
                    ? "bg-primary-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <div className="text-2xl mb-2">{category.icon}</div>
                <div className="text-sm font-medium">{category.name}</div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Products Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="py-8 px-4"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedCategory
                ? categories.find((c) => c.id === selectedCategory)?.name
                : "All"}{" "}
              Products
            </h2>
            <div className="text-sm text-gray-600">
              {productsData?.pagination?.total || 0} products
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg shadow-sm p-4 animate-pulse"
                >
                  <div className="bg-gray-200 h-48 rounded-lg mb-4"></div>
                  <div className="bg-gray-200 h-4 rounded mb-2"></div>
                  <div className="bg-gray-200 h-4 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {productsData?.products?.map((product: any) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          )}

          {!isLoading &&
            (!productsData?.products || productsData.products.length === 0) && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🛒</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No products found
                </h3>
                <p className="text-gray-600">
                  Try selecting a different category
                </p>
              </div>
            )}
        </div>
      </motion.div>
    </div>
  );
};

export default HomePage;
