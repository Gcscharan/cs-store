import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

const CategoriesPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const categories = [
    {
      id: "chocolates",
      name: t("categories.chocolates"),
      image: "https://dummyimage.com/300x200/8B4513/FFFFFF&text=Chocolates",
      color: "bg-gradient-to-br from-amber-400 to-orange-600",
      description: t("categories.chocolates_desc"),
    },
    {
      id: "ladoos",
      name: t("categories.ladoos"),
      image: "https://dummyimage.com/300x200/FFD700/000000&text=Laddus",
      color: "bg-gradient-to-br from-yellow-400 to-yellow-600",
      description: t("categories.ladoos_desc"),
    },
    {
      id: "biscuits",
      name: t("categories.biscuits"),
      image: "https://dummyimage.com/300x200/DEB887/000000&text=Biscuits",
      color: "bg-gradient-to-br from-amber-300 to-amber-500",
      description: t("categories.biscuits_desc"),
    },
    {
      id: "cakes",
      name: t("categories.cakes"),
      image: "https://dummyimage.com/300x200/FF69B4/FFFFFF&text=Cakes",
      color: "bg-gradient-to-br from-pink-400 to-pink-600",
      description: t("categories.cakes_desc"),
    },
    {
      id: "hot_snacks",
      name: t("categories.hot_snacks"),
      image: "https://dummyimage.com/300x200/FF4500/FFFFFF&text=Hot+Snacks",
      color: "bg-gradient-to-br from-red-400 to-orange-600",
      description: t("categories.hot_snacks_desc"),
    },
    {
      id: "beverages",
      name: t("categories.beverages"),
      image: "https://dummyimage.com/300x200/87CEEB/FFFFFF&text=Beverages",
      color: "bg-gradient-to-br from-blue-400 to-cyan-600",
      description: t("categories.beverages_desc"),
    },
  ];

  const handleCategoryClick = (categoryId: string) => {
    // Navigate to the homepage with the specific category selected
    navigate(`/?category=${categoryId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white py-6 px-4 shadow-sm border-b border-gray-200"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              {t("categories.title")}
            </h1>
            <p className="text-gray-600 mt-1">{t("categories.subtitle")}</p>
          </div>
        </div>
      </motion.div>

      {/* Categories Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="py-6 px-4"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden group"
                onClick={() => handleCategoryClick(category.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCategoryClick(category.id);
                  }
                }}
              >
                {/* Category Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div
                    className={`absolute inset-0 ${category.color} opacity-20`}
                  ></div>
                  <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-30 transition-opacity duration-300"></div>
                </div>

                {/* Category Content */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">
                    {category.description}
                  </p>

                  {/* Action Button */}
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600 font-semibold text-sm group-hover:text-blue-700">
                      Shop Now
                    </span>
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <svg
                        className="w-4 h-4 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CategoriesPage;
