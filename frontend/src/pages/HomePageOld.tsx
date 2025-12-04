import { motion } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import SortingDropdown, { SortOption } from "../components/SortingDropdown";
import TopSellingSlider from "../components/TopSellingSlider";
import { useGetProductsQuery } from "../store/api";
import { getProductImage } from "../utils/image";

const HomePage = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("price_low_high");
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Fetch products from API
  const { data: productsData } = useGetProductsQuery({
    limit: 100, // Get all products
  });

  // Listen for search updates from the layout
  useEffect(() => {
    const handleSearchUpdate = (query: string) => {
      setSearchQuery(query);
    };

    // Store the update function globally for Layout to use
    (window as any).searchQueryUpdate = handleSearchUpdate;

    return () => {
      delete (window as any).searchQueryUpdate;
    };
  }, []);

  // Process products from API
  const products = productsData?.products || [];
  
  // Group products by category
  const productData = {
    chocolates: products.filter((p: any) => p.category === 'chocolates'),
    biscuits: products.filter((p: any) => p.category === 'biscuits'),
    ladoos: [
      {
        id: 21,
        name: "Besan Laddu",
        price: 40,
        image: "https://dummyimage.com/200x200/FFD700/000000&text=Besan",
        mrp: 55,
      },
      {
        id: 22,
        name: "Coconut Laddu",
        price: 35,
        image: "https://dummyimage.com/200x200/FFFFFF/000000&text=Coconut",
        mrp: 48,
      },
      {
        id: 23,
        name: "Motichoor Laddu",
        price: 45,
        image: "https://dummyimage.com/200x200/FFA500/FFFFFF&text=Motichoor",
        mrp: 60,
      },
      {
        id: 24,
        name: "Rava Laddu",
        price: 38,
        image: "https://dummyimage.com/200x200/F5DEB3/000000&text=Rava",
        mrp: 50,
      },
      {
        id: 25,
        name: "Til Laddu",
        price: 42,
        image: "https://dummyimage.com/200x200/8B4513/FFFFFF&text=Til",
        mrp: 55,
      },
      {
        id: 26,
        name: "Dry Fruit Laddu",
        price: 60,
        image: "https://dummyimage.com/200x200/DEB887/000000&text=Dry+Fruit",
        mrp: 80,
      },
      {
        id: 27,
        name: "Gond Laddu",
        price: 50,
        image: "https://dummyimage.com/200x200/D2691E/FFFFFF&text=Gond",
        mrp: 65,
      },
      {
        id: 28,
        name: "Churma Laddu",
        price: 48,
        image: "https://dummyimage.com/200x200/CD853F/FFFFFF&text=Churma",
        mrp: 62,
      },
      {
        id: 29,
        name: "Kaju Laddu",
        price: 55,
        image: "https://dummyimage.com/200x200/FFE4B5/000000&text=Kaju",
        mrp: 70,
      },
      {
        id: 30,
        name: "Badam Laddu",
        price: 65,
        image: "https://dummyimage.com/200x200/F0E68C/000000&text=Badam",
        mrp: 85,
      },
    ],
    cakes: [
      {
        id: 31,
        name: "Chocolate Cake",
        price: 150,
        image: "https://dummyimage.com/200x200/8B4513/FFFFFF&text=Choco+Cake",
        mrp: 200,
      },
      {
        id: 32,
        name: "Vanilla Cake",
        price: 120,
        image: "https://dummyimage.com/200x200/F5F5DC/000000&text=Vanilla",
        mrp: 160,
      },
      {
        id: 33,
        name: "Strawberry Cake",
        price: 140,
        image: "https://dummyimage.com/200x200/FF69B4/FFFFFF&text=Strawberry",
        mrp: 180,
      },
      {
        id: 34,
        name: "Red Velvet Cake",
        price: 160,
        image: "https://dummyimage.com/200x200/DC143C/FFFFFF&text=Red+Velvet",
        mrp: 220,
      },
      {
        id: 35,
        name: "Cheese Cake",
        price: 180,
        image: "https://dummyimage.com/200x200/FFE4B5/000000&text=Cheese",
        mrp: 240,
      },
    ],
    hot_snacks: [
      {
        id: 36,
        name: "Samosa",
        price: 15,
        image: "https://dummyimage.com/200x200/D2691E/FFFFFF&text=Samosa",
        mrp: 20,
      },
      {
        id: 37,
        name: "Pakora",
        price: 20,
        image: "https://dummyimage.com/200x200/228B22/FFFFFF&text=Pakora",
        mrp: 28,
      },
      {
        id: 38,
        name: "Vada",
        price: 12,
        image: "https://dummyimage.com/200x200/FFD700/000000&text=Vada",
        mrp: 18,
      },
      {
        id: 39,
        name: "Bonda",
        price: 18,
        image: "https://dummyimage.com/200x200/CD853F/FFFFFF&text=Bonda",
        mrp: 25,
      },
      {
        id: 40,
        name: "Cutlet",
        price: 25,
        image: "https://dummyimage.com/200x200/8B4513/FFFFFF&text=Cutlet",
      },
    ],
  };

  // Top-selling products data (dynamically updated based on customer interests)
  const topSellingProducts = [
    {
      id: 1,
      name: "Cadbury Dairy Milk",
      image: "https://dummyimage.com/200x200/8B4513/FFFFFF&text=Cadbury",
      category: "chocolates",
    },
    {
      id: 21,
      name: "Besan Laddu",
      image: "https://dummyimage.com/200x200/FFD700/000000&text=Besan",
      category: "ladoos",
    },
    {
      id: 31,
      name: "Parle-G Biscuits",
      image: "https://dummyimage.com/200x200/DEB887/000000&text=Parle-G",
      category: "biscuits",
    },
    {
      id: 41,
      name: "Chocolate Cake",
      image: "https://dummyimage.com/200x200/8B4513/FFFFFF&text=Cake",
      category: "cakes",
    },
    {
      id: 51,
      name: "Samosa",
      image: "https://dummyimage.com/200x200/FF4500/FFFFFF&text=Samosa",
      category: "hot_snacks",
    },
    {
      id: 2,
      name: "KitKat 4 Finger",
      image: "https://dummyimage.com/200x200/FF6347/FFFFFF&text=KitKat",
      category: "chocolates",
    },
    {
      id: 22,
      name: "Coconut Laddu",
      image: "https://dummyimage.com/200x200/FFFFFF/000000&text=Coconut",
      category: "ladoos",
    },
    {
      id: 32,
      name: "Marie Biscuits",
      image: "https://dummyimage.com/200x200/F5DEB3/000000&text=Marie",
      category: "biscuits",
    },
  ];

  const categories = [
    { id: "all", name: t("home.for_you"), icon: "⭐" },
    { id: "chocolates", name: t("categories.chocolates"), icon: "🍫" },
    { id: "ladoos", name: t("categories.ladoos"), icon: "🥮" },
    { id: "biscuits", name: t("categories.biscuits"), icon: "🍪" },
    { id: "cakes", name: t("categories.cakes"), icon: "🎂" },
    { id: "hot_snacks", name: t("categories.hot_snacks"), icon: "🌶️" },
  ];

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let products: any[] = [];

    if (selectedCategory === "all") {
      // Show all products from all categories
      products = [
        ...productData.chocolates,
        ...productData.ladoos,
        ...productData.biscuits,
        ...productData.cakes,
        ...productData.hot_snacks,
      ];
    } else {
      products =
        productData[selectedCategory as keyof typeof productData] || [];
    }

    // Apply search filter
    if (searchQuery) {
      products = products.filter((product: any) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    const sortedProducts = [...products].sort((a, b) => {
      switch (sortBy) {
        case "price_low_high":
          return a.price - b.price;
        case "price_high_low":
          return b.price - a.price;
        case "popularity":
          // Simulate popularity based on product ID (lower ID = more popular)
          return parseInt(a.id) - parseInt(b.id);
        case "newest":
          // Simulate newest based on product ID (higher ID = newer)
          return parseInt(b.id) - parseInt(a.id);
        case "best_selling":
          // Simulate best selling based on price (lower price = more sales)
          return a.price - b.price;
        default:
          return 0;
      }
    });

    return sortedProducts;
  }, [selectedCategory, searchQuery, sortBy]);

  const handleAddToCart = (product: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation when clicking add to cart
    // Add to cart functionality
    console.log("Added to cart:", product);
  };

  const handleProductClick = (product: any) => {
    navigate(`/product/${product.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Selling Products Slider */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-orange-50 to-red-50 py-6 px-4 shadow-sm"
      >
        <div className="max-w-7xl mx-auto">
          <TopSellingSlider products={topSellingProducts} />
        </div>
      </motion.div>

      {/* Category Slider */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white py-4 px-4 shadow-sm"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex space-x-4 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex-shrink-0 px-6 py-3 rounded-full text-center transition-all duration-200 ${
                  selectedCategory === category.id
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <div className="text-2xl mb-1">{category.icon}</div>
                <div className="text-sm font-medium">{category.name}</div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* For You Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="py-6 px-4"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">
              {selectedCategory === "all"
                ? t("home.for_you")
                : categories.find((c) => c.id === selectedCategory)?.name}
            </h2>

            {/* Sorting Dropdown */}
            <SortingDropdown
              currentSort={sortBy}
              onSortChange={setSortBy}
              className="w-full sm:w-auto"
            />
          </div>

          <div
            className={`grid gap-4 ${
              selectedCategory === "all"
                ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                : "grid-cols-2 md:grid-cols-4"
            }`}
          >
            {filteredProducts.map((product) => (
              <motion.div
                key={product.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => handleProductClick(product)}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer"
              >
                <div className="aspect-square mb-3">
                  <img
                    src={getProductImage(product)}
                    alt={product.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
                  {product.name}
                </h3>
                <div className="mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-600 font-bold text-lg">
                      ₹{product.price}
                    </span>
                    {product.mrp && product.mrp > product.price && (
                      <span className="text-gray-500 text-sm line-through">
                        ₹{product.mrp}
                      </span>
                    )}
                  </div>
                  {product.mrp && product.mrp > product.price && (
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Save ₹{product.mrp - product.price}
                      </span>
                    </div>
                  )}
            </div>
                <button
                  onClick={(e) => handleAddToCart(product, e)}
                  className="w-full bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Add to Cart</span>
                </button>
              </motion.div>
              ))}
            </div>

          {filteredProducts.length === 0 && (
              <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No products found
                </h3>
                <p className="text-gray-600">
                Try searching with different keywords
                </p>
              </div>
            )}

          {/* End of Products Message */}
          {filteredProducts.length > 0 && (
            <div className="text-center py-8 mt-8">
              <div className="inline-flex items-center space-x-2 text-gray-500 bg-gray-100 px-6 py-3 rounded-full">
                <div className="text-2xl">🏁</div>
                <span className="text-sm font-medium">
                  {t("home.end_of_products")}
                </span>
              </div>
              </div>
            )}
        </div>
      </motion.div>
    </div>
  );
};

export default HomePage;
