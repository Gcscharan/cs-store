import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, SortAsc } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

export type SortOption =
  | "price_low_high"
  | "price_high_low"
  | "popularity"
  | "newest"
  | "best_selling";

interface SortingDropdownProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  className?: string;
}

const SortingDropdown: React.FC<SortingDropdownProps> = ({
  currentSort,
  onSortChange,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "price_low_high", label: t("sort.price_low_high") },
    { value: "price_high_low", label: t("sort.price_high_low") },
    { value: "popularity", label: t("sort.popularity") },
    { value: "newest", label: t("sort.newest") },
    { value: "best_selling", label: t("sort.best_selling") },
  ];

  const currentLabel =
    sortOptions.find((option) => option.value === currentSort)?.label ||
    t("sort.price_low_high");

  const handleSortChange = (sort: SortOption) => {
    onSortChange(sort);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white border border-neutral-300 rounded-lg px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 shadow-flipkart hover:shadow-flipkart-hover"
        aria-label={`${t("sort.title")}: ${currentLabel}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <SortAsc className="h-4 w-4 text-gray-500" />
        <span className="hidden sm:inline">{t("sort.title")}:</span>
        <span className="font-semibold">{currentLabel}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-lg shadow-flipkart-hover z-50"
            role="listbox"
          >
            {sortOptions.map((option) => (
              <motion.button
                key={option.value}
                whileHover={{ backgroundColor: "#f3f4f6" }}
                onClick={() => handleSortChange(option.value)}
                className={`w-full text-left px-4 py-3 text-sm transition-all duration-200 first:rounded-t-lg last:rounded-b-lg ${
                  currentSort === option.value
                    ? "bg-gradient-to-r from-primary-50 to-blue-50 text-primary-700 font-semibold"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
                role="option"
                aria-selected={currentSort === option.value}
              >
                <div className="flex items-center justify-between">
                  <span>{option.label}</span>
                  {currentSort === option.value && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2 h-2 bg-blue-600 rounded-full"
                    />
                  )}
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default SortingDropdown;
