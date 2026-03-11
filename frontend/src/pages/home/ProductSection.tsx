import { memo, useCallback, useEffect, useMemo, useState, type MouseEvent, lazy, Suspense } from "react";
import { Star } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useGetProductsQuery, useAddToCartMutation } from "../../store/api";
import { useDispatch, useSelector, useStore, shallowEqual } from "react-redux";
import { RootState } from "../../store";
import { addToCart, setCart } from "../../store/slices/cartSlice";
import { useToast } from "../../components/AccessibleToast";
import OptimizedImage from "../../components/OptimizedImage";
import { motion } from "framer-motion";
import { useOtpModal } from "../../contexts/OtpModalContext";
import { useTokenRefresh } from "../../hooks/useTokenRefresh";
import { getGradientPlaceholder } from "../../utils/mockImages";
import { useLanguage } from "../../contexts/LanguageContext";

// Lazy load TopSellingSlider for better code splitting
const TopSellingSlider = lazy(() => import("../../components/TopSellingSlider"));

const HOME_PRODUCTS_LIMIT = 24;

const HOME_PLACEHOLDER_IMAGE: any = {
  variants: {
    micro: "/placeholder-product.svg",
    thumb: "/placeholder-product.svg",
    small: "/placeholder-product.svg",
    medium: "/placeholder-product.svg",
    large: "/placeholder-product.svg",
    original: "/placeholder-product.svg",
  },
};

const HomeGuestOnly = function HomeGuestOnly({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  if (isAuthenticated) return null;
  return <>{children}</>;
};

const HomeHeader = memo(function HomeHeader() {
  const { showOtpModal } = useOtpModal();
  const { refreshToken } = useTokenRefresh();
  const { t } = useLanguage();

  const auth = useSelector(
    (state: RootState) => ({
      isAuthenticated: state.auth.isAuthenticated,
      loading: state.auth.loading,
      accessToken: state.auth.tokens?.accessToken || "",
    }),
    shallowEqual
  );

  const [selectedGuestCategory, setSelectedGuestCategory] = useState("all");

  useEffect(() => {
    const validateAuth = async () => {
      if (auth.isAuthenticated && auth.accessToken) {
        try {
          const payload = JSON.parse(atob(auth.accessToken.split(".")[1]));
          const currentTime = Math.floor(Date.now() / 1000);
          if (payload.exp < currentTime) {
            const refreshSuccess = await refreshToken();
            if (!refreshSuccess) {
              // ignore
            }
          }
        } catch {
          const refreshSuccess = await refreshToken();
          if (!refreshSuccess) {
            // ignore
          }
        }
      }
    };

    validateAuth();
  }, [auth.accessToken, auth.isAuthenticated, refreshToken]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      return;
    }
    if (auth.loading) {
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const showLogin = urlParams.get("showLogin");

    if (showLogin === "true") {
      showOtpModal("/account/profile");
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [showOtpModal, auth.isAuthenticated, auth.loading]);

  const handleGuestCategoryClick = useCallback((category: string) => {
    setSelectedGuestCategory(category);
  }, []);

  return (
    <HomeGuestOnly>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white py-8 px-4"
      >
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            {t("home.browseCategories")}
          </h2>
          <div className="grid grid-cols-3 gap-8 max-w-7xl mx-auto">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleGuestCategoryClick("chocolates")}
              className={`relative bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-8 text-white overflow-hidden group min-h-[200px] ${
                selectedGuestCategory === "chocolates" ? "ring-4 ring-orange-300" : ""
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-500/20"></div>
              <div className="relative z-10">
                <div className="text-base opacity-90 mb-3">{t("home.premiumChocolates")}</div>
                <div className="text-2xl font-bold mb-3">{t("home.chocolates")}</div>
                <div className="text-lg opacity-90">{t("home.fromPrice", { price: "99" })}</div>
              </div>
              <div className="absolute -bottom-4 -right-4 text-8xl opacity-20 group-hover:opacity-30 transition-opacity">
                🍫
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleGuestCategoryClick("biscuits")}
              className={`relative bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-8 text-white overflow-hidden group min-h-[200px] ${
                selectedGuestCategory === "biscuits" ? "ring-4 ring-orange-300" : ""
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-500/20"></div>
              <div className="relative z-10">
                <div className="text-base opacity-90 mb-3">{t("home.crunchyCrispy")}</div>
                <div className="text-2xl font-bold mb-3">{t("home.biscuits")}</div>
                <div className="text-lg opacity-90">{t("home.fromPrice", { price: "49" })}</div>
              </div>
              <div className="absolute -bottom-4 -right-4 text-8xl opacity-20 group-hover:opacity-30 transition-opacity">
                🍪
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleGuestCategoryClick("ladoos")}
              className={`relative bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-8 text-white overflow-hidden group min-h-[200px] ${
                selectedGuestCategory === "ladoos" ? "ring-4 ring-orange-300" : ""
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-500/20"></div>
              <div className="relative z-10">
                <div className="text-base opacity-90 mb-3">{t("home.traditionalSweets")}</div>
                <div className="text-2xl font-bold mb-3">{t("home.festiveLadoos")}</div>
                <div className="text-lg opacity-90">{t("home.fromPrice", { price: "199" })}</div>
              </div>
              <div className="absolute -bottom-4 -right-4 text-8xl opacity-20 group-hover:opacity-30 transition-opacity">
                🥮
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleGuestCategoryClick("cakes")}
              className={`relative bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-8 text-white overflow-hidden group min-h-[200px] ${
                selectedGuestCategory === "cakes" ? "ring-4 ring-orange-300" : ""
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-500/20"></div>
              <div className="relative z-10">
                <div className="text-base opacity-90 mb-3">{t("home.freshBakedDaily")}</div>
                <div className="text-2xl font-bold mb-3">{t("home.birthdayCakes")}</div>
                <div className="text-lg opacity-90">{t("home.fromPrice", { price: "299" })}</div>
              </div>
              <div className="absolute -bottom-4 -right-4 text-8xl opacity-20 group-hover:opacity-30 transition-opacity">
                🎂
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleGuestCategoryClick("hot_snacks")}
              className={`relative bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-8 text-white overflow-hidden group min-h-[200px] ${
                selectedGuestCategory === "hot_snacks" ? "ring-4 ring-orange-300" : ""
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-500/20"></div>
              <div className="relative z-10">
                <div className="text-base opacity-90 mb-3">{t("home.spicyTangy")}</div>
                <div className="text-2xl font-bold mb-3">{t("home.hotSnacks")}</div>
                <div className="text-lg opacity-90">{t("home.fromPrice", { price: "99" })}</div>
              </div>
              <div className="absolute -bottom-4 -right-4 text-8xl opacity-20 group-hover:opacity-30 transition-opacity">
                🌶️
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleGuestCategoryClick("beverages")}
              className={`relative bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-8 text-white overflow-hidden group min-h-[200px] ${
                selectedGuestCategory === "beverages" ? "ring-4 ring-orange-300" : ""
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-500/20"></div>
              <div className="relative z-10">
                <div className="text-base opacity-90 mb-3">{t("home.refreshingDrinks")}</div>
                <div className="text-2xl font-bold mb-3">{t("home.beverages")}</div>
                <div className="text-lg opacity-90">{t("home.fromPrice", { price: "29" })}</div>
              </div>
              <div className="absolute -bottom-4 -right-4 text-8xl opacity-20 group-hover:opacity-30 transition-opacity">
                🥤
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </HomeGuestOnly>
  );
});

const HomeFooter = memo(function HomeFooter() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <>
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              {t("home.downloadApp")}
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              {t("home.downloadAppSub")}
            </p>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <button
                onClick={() => navigate("/download-app")}
                className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {t("home.downloadBtn")}
              </button>
              <button
                onClick={() => navigate("/download-app")}
                className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-blue-600 transition-colors"
              >
                {t("home.learnMore")}
              </button>
            </div>
            <div className="mt-8 flex justify-center space-x-8 text-blue-100">
              <div className="text-center">
                <div className="text-2xl font-bold">4.8★</div>
                <div className="text-sm">{t("home.appStoreRating")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">1M+</div>
                <div className="text-sm">{t("home.downloads")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">24/7</div>
                <div className="text-sm">{t("home.support")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-gray-900 text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-orange-400">{t("footer.about")}</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/contact-us" className="hover:text-orange-400 transition-colors">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link to="/about-us" className="hover:text-orange-400 transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/careers" className="hover:text-orange-400 transition-colors">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link
                    to="/cs-store-stories"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Vyapara Setu Stories
                  </Link>
                </li>
                <li>
                  <Link
                    to="/corporate-information"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Corporate Information
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 text-orange-400">{t("footer.help")}</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/payment" className="hover:text-orange-400 transition-colors">
                    Payments
                  </Link>
                </li>
                <li>
                  <Link to="/shipping" className="hover:text-orange-400 transition-colors">
                    Shipping
                  </Link>
                </li>
                <li>
                  <Link
                    to="/cancellation"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Cancellation & Returns
                  </Link>
                </li>
                <li>
                  <Link to="/faq" className="hover:text-orange-400 transition-colors">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    to="/report-infringement"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Report Infringement
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 text-orange-400">{t("footer.consumerPolicy")}</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/terms" className="hover:text-orange-400 transition-colors">
                    Terms Of Use
                  </Link>
                </li>
                <li>
                  <Link to="/security" className="hover:text-orange-400 transition-colors">
                    Security
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-orange-400 transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link to="/sitemap" className="hover:text-orange-400 transition-colors">
                    Sitemap
                  </Link>
                </li>
                <li>
                  <Link to="/grievance" className="hover:text-orange-400 transition-colors">
                    Grievance Redressal
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 text-orange-400">{t("footer.mailUs")}</h3>
              <p className="text-sm text-gray-400">
                Vyapara Setu
                <br />
                📍 Tiruvuru, Krishna District,
                <br />
                Andhra Pradesh, India – 521235
                <br />
                📧 support@csstore.com
                <br />
                📞 +91-9391795162
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 pb-4">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
            <div className="flex space-x-6 mb-4 md:mb-0">
              <Link to="/seller" className="hover:text-orange-400">
                {t("footer.becomeSeller")}
              </Link>
              <Link to="/advertise" className="hover:text-orange-400">
                {t("footer.advertise")}
              </Link>
              <Link to="/gift-cards" className="hover:text-orange-400">
                {t("footer.giftCards")}
              </Link>
              <Link to="/help" className="hover:text-orange-400">
                {t("footer.helpCenter")}
              </Link>
            </div>
            <div className="mb-4 md:mb-0">{t("footer.copyright")}</div>
            <div>
              <img
                src={getGradientPlaceholder('Banner', 1200, 300).src}
                alt={t("footer.paymentMethods")}
                className="h-6"
              />
            </div>
          </div>
        </div>
      </footer>
    </>
  );
});

const HomeFeaturedProductCard = memo(function HomeFeaturedProductCard({
  product,
  index: _index,
  onNavigateToProduct,
  onAddToCart,
}: {
  product: any;
  index: number;
  onNavigateToProduct: (id: string) => void;
  onAddToCart: (product: any) => void;
}) {
  const { t } = useLanguage();
  const id = String(product._id || product.id || "");
  const img = product.images?.[0] || HOME_PLACEHOLDER_IMAGE;
  const priority = false;
  const fetchPriority = "auto";

  const handleNavigate = useCallback(() => {
    onNavigateToProduct(id);
  }, [id, onNavigateToProduct]);

  const handleAdd = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onAddToCart(product);
    },
    [onAddToCart, product]
  );

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden group cursor-pointer"
      onClick={handleNavigate}
    >
      <div className="relative h-48 overflow-hidden">
        <OptimizedImage
          image={img}
          size="small"
          alt={product.name}
          className="w-full h-full group-hover:scale-105 transition-transform duration-300"
          productId={id}
          debug={false}
          priority={priority}
          fetchPriority={fetchPriority}
        />
        {product.discount > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
            {product.discount}% OFF
          </div>
        )}
        <div className="absolute inset-0 bg-black bg-opacity-10 group-hover:bg-opacity-0 transition-opacity duration-300"></div>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-1 truncate">{product.name}</h3>
        <p className="text-sm text-gray-500 mb-2">{product.category}</p>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-gray-900">₹{product.price.toFixed(2)}</span>
            {product.mrp && product.mrp > product.price && (
              <span className="text-sm text-gray-500 line-through">₹{product.mrp.toFixed(2)}</span>
            )}
          </div>
          <div className="flex items-center text-yellow-500">
            <Star className="h-4 w-4 fill-current" />
            <span className="ml-1 text-sm text-gray-600">4.5</span>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg transition-colors duration-300 font-semibold"
        >
          {t("common.add_to_cart")}
        </button>
      </div>
    </motion.div>
  );
});

const HomeTopDealCard = memo(function HomeTopDealCard({
  product,
  index,
  onNavigateToProduct,
  onAddToCart,
}: {
  product: any;
  index: number;
  onNavigateToProduct: (id: string) => void;
  onAddToCart: (product: any) => void;
}) {
  const { t } = useLanguage();
  const id = String(product.id || product._id || "");
  const img = product.images?.[0] || HOME_PLACEHOLDER_IMAGE;
  const priority = false;
  const fetchPriority = "auto";

  const handleNavigate = useCallback(() => {
    onNavigateToProduct(id);
  }, [id, onNavigateToProduct]);

  const handleAdd = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAddToCart(product);
    },
    [onAddToCart, product]
  );

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden group cursor-pointer"
      onClick={handleNavigate}
    >
      <div className="relative h-56 overflow-hidden">
        <OptimizedImage
          image={img}
          size="small"
          alt={product.name}
          className="w-full h-full"
          productId={id}
          debug={false}
          priority={priority}
          fetchPriority={fetchPriority}
        />
        {product.discount > 0 && (
          <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            {product.discount}% OFF
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-xl font-semibold text-gray-800 mb-2 truncate">{product.name}</h3>
        <p className="text-sm text-gray-500 mb-3">{product.category}</p>
        <div className="flex items-baseline space-x-2 mb-4">
          <span className="text-2xl font-bold text-gray-900">₹{product.discountedPrice.toFixed(2)}</span>
          {product.originalPrice > product.discountedPrice && (
            <span className="text-sm text-gray-500 line-through">₹{product.originalPrice.toFixed(2)}</span>
          )}
        </div>
        <div className="flex items-center mb-4">
          <div className="flex text-yellow-400">
            <Star className="h-4 w-4 fill-current" />
            <Star className="h-4 w-4 fill-current" />
            <Star className="h-4 w-4 fill-current" />
            <Star className="h-4 w-4 fill-current" />
            <Star className="h-4 w-4 text-gray-300" />
          </div>
          <span className="ml-2 text-sm text-gray-600">4.5</span>
        </div>
        <button
          onClick={handleAdd}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg transition-colors duration-300 font-semibold"
        >
          {t("common.add_to_cart")}
        </button>
      </div>
    </motion.div>
  );
});

const HomeGuestProductSections = memo(function HomeGuestProductSections({
  products,
  onNavigateToProduct,
  onAddToCart,
}: {
  products: any[];
  onNavigateToProduct: (id: string) => void;
  onAddToCart: (product: any) => void;
}) {
  const { t } = useLanguage();
  const topDealsProducts = useMemo(() => {
    if (products.length === 0) return [];
    const shuffled = [...products].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6).map((product: any) => ({
      id: product._id || product.id,
      name: product.name,
      images: product.images,
      category: product.category,
      price: product.price,
      mrp: product.mrp || product.price * 1.2,
      discountedPrice: product.price,
      originalPrice: product.mrp ? product.mrp : product.price * 1.2,
      discount: product.mrp ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 20,
    }));
  }, [products]);

  const featuredProducts = useMemo(() => {
    if (products.length === 0) return [];
    return products.slice(0, 12).map((product: any) => ({
      ...product,
      _id: product._id || product.id,
      id: product._id || product.id,
      mrp: product.mrp || 0,
      discount:
        product.mrp && product.mrp > product.price
          ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
          : 0,
    }));
  }, [products]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gray-50 py-8 px-4"
      >
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">{t("home.featuredProducts")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {featuredProducts.map((product: any, index: number) => (
              <HomeFeaturedProductCard
                key={product._id || product.id}
                product={product}
                index={index}
                onNavigateToProduct={onNavigateToProduct}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-red-50 via-orange-50 to-yellow-50 py-8 px-4 shadow-lg relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-red-200 to-orange-200 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-yellow-200 to-red-200 rounded-full blur-2xl"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("home.topDeals")}</h2>
            <p className="text-lg text-gray-600">{t("home.limitedTimeOffers")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {topDealsProducts.map((product: any, index: number) => (
              <HomeTopDealCard
                key={product.id}
                product={product}
                index={index}
                onNavigateToProduct={onNavigateToProduct}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
});

const HomeTopSelling = memo(function HomeTopSelling({ products }: { products: any[] }) {
  const topSellingProducts = useMemo(() => {
    if (products.length === 0) return [];
    const shuffled = [...products].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 8).map((product: any) => ({
      _id: product._id || product.id,
      id: product._id || product.id,
      name: product.name,
      image:
        product.images?.[0]?.variants?.small ||
        product.images?.[0]?.variants?.thumb ||
        product.images?.[0]?.thumb ||
        product.images?.[0]?.full ||
        "/placeholder-product.svg",
      category: product.category,
    }));
  }, [products]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-r from-secondary-50 via-orange-50 to-yellow-50 py-8 px-4 shadow-flipkart relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-200 to-red-200 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-pink-200 to-orange-200 rounded-full blur-2xl"></div>
      </div>
      <div className="max-w-7xl mx-auto">
        <Suspense fallback={null}>
          <TopSellingSlider products={topSellingProducts} />
        </Suspense>
      </div>
    </motion.div>
  );
});

const ProductSection = memo(function ProductSection() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const { t } = useLanguage();

  const handleNavigateToProduct = useCallback(
    (id: string) => {
      navigate(`/product/${id}`);
    },
    [navigate]
  );

  // Fetch products from API
  const {
    data: productsData,
    isLoading,
    error,
  } = useGetProductsQuery({
    limit: HOME_PRODUCTS_LIMIT,
  });

  const products = productsData?.products ?? [];

  const [addToCartMutation] = useAddToCartMutation();
  const { success, error: showError } = useToast();

  const handleAddToCart = useCallback(
    async (product: any) => {
      const isAuthenticated = store.getState().auth.isAuthenticated;
      if (!isAuthenticated) {
        navigate("/login");
        return;
      }

      try {
        dispatch(
          addToCart({
            id: product._id || product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            image:
              product.images?.[0]?.variants?.small ||
              product.images?.[0]?.variants?.thumb ||
              product.images?.[0]?.thumb ||
              product.images?.[0]?.full ||
              "/placeholder-product.svg",
          })
        );

        const result = await addToCartMutation({
          productId: product._id || product.id,
          quantity: 1,
        });

        if (result && "data" in result && result.data) {
          dispatch(
            setCart({
              items: result.data.cart.items,
              total: result.data.cart.total,
              itemCount: result.data.cart.itemCount,
            })
          );
        }

        success("Added to Cart", `${product.name} has been added to your cart.`);
      } catch (error) {
        console.error("Error adding to cart:", error);
        showError("Failed to add to cart", "Please try again.");
      }
    },
    [addToCartMutation, dispatch, navigate, showError, store, success]
  );

  // Show loading state
  if (isLoading) {
    return null; // Parent will show skeleton
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t("home.errorLoadingProducts")}
          </h2>
          <p className="text-gray-600 mb-4">
            {error && "message" in error
              ? (error as any).message
              : t("home.somethingWentWrong")}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* SEO Content - Hidden but accessible to search engines */}
      <div className="sr-only">
        <h1>Vyapara Setu - Online Shopping for Electronics, Fashion & More</h1>
        <h2>Welcome to Vyapara Setu</h2>
        <p>
          Vyapara Setu is your one-stop destination for online shopping. Discover
          amazing deals on electronics, fashion, home & garden, and more. We
          offer fast delivery, secure payments, and excellent customer service.
        </p>
        <h3>Shop by Category</h3>
        <ul>
          <li>Electronics - Latest smartphones, laptops, gadgets and more</li>
          <li>
            Fashion - Trendy clothing, shoes, accessories for men and women
          </li>
        </ul>
      </div>

      <HomeTopSelling products={products} />
      <HomeHeader />
      <HomeGuestOnly>
        <HomeGuestProductSections
          products={products}
          onNavigateToProduct={handleNavigateToProduct}
          onAddToCart={handleAddToCart}
        />
      </HomeGuestOnly>
      <HomeFooter />
    </div>
  );
});

export default ProductSection;
