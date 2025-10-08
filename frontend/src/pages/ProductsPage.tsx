import { motion } from "framer-motion";

const ProductsPage = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 py-8 px-4"
    >
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Products</h1>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🛍️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Products Page
          </h3>
          <p className="text-gray-600">Coming soon...</p>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductsPage;
