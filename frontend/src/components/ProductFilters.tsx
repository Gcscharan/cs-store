import React from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

interface ProductFiltersProps {
  filters: {
    category: string;
    minPrice: string;
    maxPrice: string;
    search: string;
    sortBy: string;
    sortOrder: string;
  };
  onFiltersChange: (filters: any) => void;
}

const ProductFilters: React.FC<ProductFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const { t } = useLanguage();

  const categories = [
    { value: "", label: t("filters.categories.all") },
    { value: "groceries", label: t("filters.categories.groceries") },
    { value: "vegetables", label: t("filters.categories.vegetables") },
    { value: "fruits", label: t("filters.categories.fruits") },
    { value: "dairy", label: t("filters.categories.dairy") },
    { value: "meat", label: t("filters.categories.meat") },
    { value: "beverages", label: t("filters.categories.beverages") },
    { value: "snacks", label: t("filters.categories.snacks") },
    { value: "household", label: t("filters.categories.household") },
    { value: "personal_care", label: t("filters.categories.personalCare") },
    { value: "medicines", label: t("filters.categories.medicines") },
    { value: "electronics", label: t("filters.categories.electronics") },
    { value: "clothing", label: t("filters.categories.clothing") },
    { value: "other", label: t("filters.categories.other") },
  ];

  const sortOptions = [
    { value: "createdAt", label: t("filters.sort.newest") },
    { value: "price", label: t("filters.sort.priceLow") },
    { value: "-price", label: t("filters.sort.priceHigh") },
    { value: "name", label: t("filters.sort.nameAZ") },
    { value: "-name", label: t("filters.sort.nameZA") },
  ];
  // Safety check to prevent errors if filters is undefined
  if (!filters) {
    return null;
  }

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-lg shadow-md mb-6"
    >
      <h3 className="text-lg font-semibold mb-4">{t("filters.title")}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("common.search")}
          </label>
          <div className="relative">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              placeholder={t("filters.searchPlaceholder")}
              className="w-full px-3 py-2 pl-10 pr-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("filters.category")}
          </label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange("category", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        {/* Min Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("filters.minPrice")}
          </label>
          <input
            type="number"
            value={filters.minPrice}
            onChange={(e) => handleFilterChange("minPrice", e.target.value)}
            placeholder="0"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Max Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("filters.maxPrice")}
          </label>
          <input
            type="number"
            value={filters.maxPrice}
            onChange={(e) => handleFilterChange("maxPrice", e.target.value)}
            placeholder="10000"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Sort */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("filters.sortBy")}
        </label>
        <select
          value={filters.sortBy}
          onChange={(e) => handleFilterChange("sortBy", e.target.value)}
          className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={() =>
            onFiltersChange({
              category: "",
              minPrice: "",
              maxPrice: "",
              search: "",
              sortBy: "createdAt",
              sortOrder: "desc",
            })
          }
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          {t("filters.clearAll")}
        </button>
      </div>
    </motion.div>
  );
};

export default ProductFilters;
