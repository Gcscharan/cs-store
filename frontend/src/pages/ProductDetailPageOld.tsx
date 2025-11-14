import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  Heart,
  Share2,
  Star,
  Truck,
  Shield,
  RotateCcw,
  CreditCard,
} from "lucide-react";
import ProductMediaCarousel from "../components/ProductMediaCarousel";
import { useLanguage } from "../contexts/LanguageContext";
import { useGetProductByIdQuery } from "../store/api";

interface MediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnail?: string;
  alt?: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
  media?: MediaItem[];
  features?: string[];
  specifications?: { [key: string]: string };
  inStock?: boolean;
  rating?: number;
  reviews?: number;
  deliveryDate?: string;
  estimatedDelivery?: string;
  mrp?: number;
}

const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [quantity, setQuantity] = useState(1);

  // Check if it's a fallback product ID (starts with "fallback-")
  const isFallbackProduct = id?.startsWith("fallback-") || false;

  // Fetch product from API (skip if fallback product)
  const {
    data: product,
    isLoading,
    error,
  } = useGetProductByIdQuery(id || "", {
    skip: !id || isFallbackProduct,
  });

  // Similar products (you can implement this with a separate API call)
  const similarProducts = [
    {
      id: 1,
      name: "Cadbury Dairy Milk",
      price: 25,
      image: "https://dummyimage.com/200x200/8B4513/FFFFFF&text=Cadbury",
      category: "chocolates",
      rating: 4.5,
    },
    {
      id: 2,
      name: "KitKat 4 Finger",
      price: 20,
      description:
        "Crispy wafer fingers covered in smooth milk chocolate. Break it, share it, enjoy it!",
      category: "chocolates",
      image: "https://dummyimage.com/400x400/FF6347/FFFFFF&text=KitKat",
      media: [
        {
          id: "kitkat-1",
          type: "image",
          url: "https://dummyimage.com/600x600/FF6347/FFFFFF&text=KitKat+Front",
          alt: "KitKat front view",
        },
        {
          id: "kitkat-2",
          type: "image",
          url: "https://dummyimage.com/600x600/FF6347/FFFFFF&text=KitKat+Open",
          alt: "KitKat opened view",
        },
        {
          id: "kitkat-video",
          type: "video",
          url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
          thumbnail:
            "https://dummyimage.com/600x600/FF6347/FFFFFF&text=KitKat+Video",
          alt: "KitKat video demonstration",
        },
      ],
      features: [
        "Crispy wafer layers",
        "Smooth milk chocolate coating",
        "Perfect for sharing",
        "No artificial colors",
      ],
      specifications: {
        Weight: "41.5g",
        Ingredients: "Sugar, Wheat Flour, Cocoa Butter, Milk",
        "Shelf Life": "12 months",
        Storage: "Store in cool, dry place",
      },
      inStock: true,
      rating: 4.3,
      reviews: 95,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
      mrp: 25,
    },
    // Additional products from HomePage
    {
      id: 3,
      name: "Snickers Bar",
      price: 30,
      description: "You're not you when you're hungry. Snickers satisfies.",
      category: "chocolates",
      image: "https://dummyimage.com/200x200/2F4F4F/FFFFFF&text=Snickers",
      mrp: 40,
      inStock: true,
      rating: 4.2,
      reviews: 87,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 4,
      name: "Mars Bar",
      price: 25,
      description: "Work, rest and play with Mars bar.",
      category: "chocolates",
      image: "https://dummyimage.com/200x200/DC143C/FFFFFF&text=Mars",
      mrp: 35,
      inStock: true,
      rating: 4.1,
      reviews: 76,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 5,
      name: "Twix Bar",
      price: 22,
      description: "Two for me, none for you. Twix left and right.",
      category: "chocolates",
      image: "https://dummyimage.com/200x200/DAA520/FFFFFF&text=Twix",
      mrp: 30,
      inStock: true,
      rating: 4.0,
      reviews: 65,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 6,
      name: "Bounty Bar",
      price: 28,
      description: "The taste of paradise with coconut and chocolate.",
      category: "chocolates",
      image: "https://dummyimage.com/200x200/228B22/FFFFFF&text=Bounty",
      mrp: 38,
      inStock: true,
      rating: 4.3,
      reviews: 92,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 7,
      name: "Milky Way",
      price: 24,
      description: "Smooth and creamy chocolate bar.",
      category: "chocolates",
      image: "https://dummyimage.com/200x200/4682B4/FFFFFF&text=Milky",
      mrp: 32,
      inStock: true,
      rating: 4.1,
      reviews: 58,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 8,
      name: "Galaxy Smooth",
      price: 35,
      description: "Smooth milk chocolate that melts in your mouth.",
      category: "chocolates",
      image: "https://dummyimage.com/200x200/800080/FFFFFF&text=Galaxy",
      mrp: 45,
      inStock: true,
      rating: 4.4,
      reviews: 124,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 9,
      name: "Ferrero Rocher",
      price: 45,
      description: "Premium chocolate with hazelnut filling.",
      category: "chocolates",
      image: "https://dummyimage.com/200x200/FFD700/000000&text=Ferrero",
      mrp: 60,
      inStock: true,
      rating: 4.7,
      reviews: 203,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 10,
      name: "Toblerone",
      price: 50,
      description: "Swiss chocolate with honey and almond nougat.",
      category: "chocolates",
      image: "https://dummyimage.com/200x200/FF4500/FFFFFF&text=Toblerone",
      mrp: 65,
      inStock: true,
      rating: 4.5,
      reviews: 156,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    // Biscuits
    {
      id: 11,
      name: "Parle-G Biscuits",
      price: 10,
      description: "India's favorite biscuit. G for Genius.",
      category: "biscuits",
      image: "https://dummyimage.com/200x200/FFD700/000000&text=Parle-G",
      mrp: 15,
      inStock: true,
      rating: 4.5,
      reviews: 234,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 12,
      name: "Oreo Cookies",
      price: 30,
      description: "Twist, lick, dunk. The world's favorite cookie.",
      category: "biscuits",
      image: "https://dummyimage.com/200x200/000000/FFFFFF&text=Oreo",
      mrp: 40,
      inStock: true,
      rating: 4.4,
      reviews: 189,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 13,
      name: "Good Day Biscuits",
      price: 15,
      description: "Have a good day with these delicious biscuits.",
      category: "biscuits",
      image: "https://dummyimage.com/200x200/FF8C00/FFFFFF&text=Good+Day",
      mrp: 20,
      inStock: true,
      rating: 4.2,
      reviews: 98,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 14,
      name: "Marie Gold",
      price: 12,
      description: "Light and crispy Marie biscuits.",
      category: "biscuits",
      image: "https://dummyimage.com/200x200/FFA500/FFFFFF&text=Marie",
      mrp: 18,
      inStock: true,
      rating: 4.0,
      reviews: 76,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 15,
      name: "Monaco Salted",
      price: 8,
      description: "Salted crackers perfect for tea time.",
      category: "biscuits",
      image: "https://dummyimage.com/200x200/32CD32/FFFFFF&text=Monaco",
      mrp: 12,
      inStock: true,
      rating: 4.1,
      reviews: 65,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 16,
      name: "Hide & Seek",
      price: 25,
      description: "Chocolate chip cookies with hidden chocolate chips.",
      category: "biscuits",
      image: "https://dummyimage.com/200x200/FF1493/FFFFFF&text=Hide+Seek",
      mrp: 35,
      inStock: true,
      rating: 4.3,
      reviews: 112,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 17,
      name: "Coconut Cookies",
      price: 18,
      description: "Delicious coconut flavored cookies.",
      category: "biscuits",
      image: "https://dummyimage.com/200x200/8FBC8F/FFFFFF&text=Coconut",
      mrp: 25,
      inStock: true,
      rating: 4.2,
      reviews: 89,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 18,
      name: "Digestive Biscuits",
      price: 20,
      description: "Healthy digestive biscuits for better digestion.",
      category: "biscuits",
      image: "https://dummyimage.com/200x200/D2691E/FFFFFF&text=Digestive",
      mrp: 28,
      inStock: true,
      rating: 4.1,
      reviews: 78,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 19,
      name: "Cream Biscuits",
      price: 22,
      description: "Soft and creamy biscuits with vanilla flavor.",
      category: "biscuits",
      image: "https://dummyimage.com/200x200/FFB6C1/000000&text=Cream",
      mrp: 30,
      inStock: true,
      rating: 4.0,
      reviews: 67,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 20,
      name: "Chocolate Biscuits",
      price: 28,
      description: "Rich chocolate flavored biscuits.",
      category: "biscuits",
      image: "https://dummyimage.com/200x200/8B4513/FFFFFF&text=Choco",
      mrp: 38,
      inStock: true,
      rating: 4.4,
      reviews: 134,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    // Ladoos
    {
      id: 21,
      name: "Besan Laddu",
      price: 40,
      description: "Traditional Indian sweet made with gram flour and ghee.",
      category: "ladoos",
      image: "https://dummyimage.com/200x200/FFD700/000000&text=Besan",
      mrp: 55,
      inStock: true,
      rating: 4.6,
      reviews: 156,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 22,
      name: "Coconut Laddu",
      price: 35,
      description:
        "Sweet and delicious coconut ladoos made with fresh coconut.",
      category: "ladoos",
      image: "https://dummyimage.com/200x200/FFFFFF/000000&text=Coconut",
      mrp: 48,
      inStock: true,
      rating: 4.3,
      reviews: 98,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 23,
      name: "Motichoor Laddu",
      price: 45,
      description: "Premium ladoos made with fine boondi and aromatic spices.",
      category: "ladoos",
      image: "https://dummyimage.com/200x200/FFA500/FFFFFF&text=Motichoor",
      mrp: 60,
      inStock: true,
      rating: 4.7,
      reviews: 203,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 24,
      name: "Rava Laddu",
      price: 38,
      description: "Semolina ladoos with nuts and raisins.",
      category: "ladoos",
      image: "https://dummyimage.com/200x200/F5DEB3/000000&text=Rava",
      mrp: 50,
      inStock: true,
      rating: 4.4,
      reviews: 127,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 25,
      name: "Til Laddu",
      price: 42,
      description: "Sesame seed ladoos with jaggery.",
      category: "ladoos",
      image: "https://dummyimage.com/200x200/8B4513/FFFFFF&text=Til",
      mrp: 55,
      inStock: true,
      rating: 4.5,
      reviews: 145,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 26,
      name: "Dry Fruit Laddu",
      price: 60,
      description: "Premium ladoos with mixed dry fruits and nuts.",
      category: "ladoos",
      image: "https://dummyimage.com/200x200/DEB887/000000&text=Dry+Fruit",
      mrp: 80,
      inStock: true,
      rating: 4.8,
      reviews: 189,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 27,
      name: "Gond Laddu",
      price: 50,
      description: "Traditional ladoos made with edible gum and nuts.",
      category: "ladoos",
      image: "https://dummyimage.com/200x200/D2691E/FFFFFF&text=Gond",
      mrp: 65,
      inStock: true,
      rating: 4.3,
      reviews: 112,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 28,
      name: "Churma Laddu",
      price: 48,
      description: "Sweet ladoos made with wheat flour and ghee.",
      category: "ladoos",
      image: "https://dummyimage.com/200x200/CD853F/FFFFFF&text=Churma",
      mrp: 62,
      inStock: true,
      rating: 4.2,
      reviews: 98,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 29,
      name: "Kaju Laddu",
      price: 55,
      description: "Cashew nut ladoos with cardamom flavor.",
      category: "ladoos",
      image: "https://dummyimage.com/200x200/FFE4B5/000000&text=Kaju",
      mrp: 70,
      inStock: true,
      rating: 4.6,
      reviews: 167,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    {
      id: 30,
      name: "Badam Laddu",
      price: 65,
      description: "Almond ladoos with saffron and cardamom.",
      category: "ladoos",
      image: "https://dummyimage.com/200x200/F0E68C/000000&text=Badam",
      mrp: 85,
      inStock: true,
      rating: 4.7,
      reviews: 198,
      deliveryDate: "2-3 days",
      estimatedDelivery: "Jan 15-17, 2024",
    },
    // Cakes
    {
      id: 31,
      name: "Chocolate Cake",
      price: 150,
      description: "Rich and moist chocolate cake perfect for celebrations.",
      category: "cakes",
      image: "https://dummyimage.com/200x200/8B4513/FFFFFF&text=Choco+Cake",
      mrp: 200,
      inStock: true,
      rating: 4.8,
      reviews: 145,
      deliveryDate: "3-4 days",
      estimatedDelivery: "Jan 16-18, 2024",
    },
    {
      id: 32,
      name: "Vanilla Cake",
      price: 120,
      description: "Classic vanilla cake with smooth buttercream frosting.",
      category: "cakes",
      image: "https://dummyimage.com/200x200/F5F5DC/000000&text=Vanilla",
      mrp: 160,
      inStock: true,
      rating: 4.5,
      reviews: 112,
      deliveryDate: "3-4 days",
      estimatedDelivery: "Jan 16-18, 2024",
    },
    {
      id: 33,
      name: "Strawberry Cake",
      price: 140,
      description: "Fresh strawberry cake with cream filling.",
      category: "cakes",
      image: "https://dummyimage.com/200x200/FF69B4/FFFFFF&text=Strawberry",
      mrp: 180,
      inStock: true,
      rating: 4.6,
      reviews: 128,
      deliveryDate: "3-4 days",
      estimatedDelivery: "Jan 16-18, 2024",
    },
    {
      id: 34,
      name: "Red Velvet Cake",
      price: 160,
      description: "Classic red velvet cake with cream cheese frosting.",
      category: "cakes",
      image: "https://dummyimage.com/200x200/DC143C/FFFFFF&text=Red+Velvet",
      mrp: 220,
      inStock: true,
      rating: 4.7,
      reviews: 156,
      deliveryDate: "3-4 days",
      estimatedDelivery: "Jan 16-18, 2024",
    },
    {
      id: 35,
      name: "Cheese Cake",
      price: 180,
      description: "Creamy cheesecake with berry topping.",
      category: "cakes",
      image: "https://dummyimage.com/200x200/FFE4B5/000000&text=Cheese",
      mrp: 240,
      inStock: true,
      rating: 4.9,
      reviews: 189,
      deliveryDate: "3-4 days",
      estimatedDelivery: "Jan 16-18, 2024",
    },
    // Hot Snacks
    {
      id: 36,
      name: "Samosa",
      price: 15,
      description: "Crispy fried pastry filled with spiced potatoes and peas.",
      category: "hot_snacks",
      image: "https://dummyimage.com/200x200/D2691E/FFFFFF&text=Samosa",
      mrp: 20,
      inStock: true,
      rating: 4.4,
      reviews: 267,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 37,
      name: "Pakora",
      price: 20,
      description: "Crispy vegetable fritters perfect with tea.",
      category: "hot_snacks",
      image: "https://dummyimage.com/200x200/228B22/FFFFFF&text=Pakora",
      mrp: 28,
      inStock: true,
      rating: 4.2,
      reviews: 189,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 38,
      name: "Vada",
      price: 12,
      description: "Crispy lentil fritters with coconut chutney.",
      category: "hot_snacks",
      image: "https://dummyimage.com/200x200/FFD700/000000&text=Vada",
      mrp: 18,
      inStock: true,
      rating: 4.3,
      reviews: 156,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 39,
      name: "Bonda",
      price: 18,
      description: "Spiced potato balls coated in gram flour batter.",
      category: "hot_snacks",
      image: "https://dummyimage.com/200x200/CD853F/FFFFFF&text=Bonda",
      mrp: 25,
      inStock: true,
      rating: 4.1,
      reviews: 134,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
    {
      id: 40,
      name: "Kachori",
      price: 16,
      description: "Flaky pastry filled with spiced lentil mixture.",
      category: "hot_snacks",
      image: "https://dummyimage.com/200x200/FF8C00/FFFFFF&text=Kachori",
      mrp: 22,
      inStock: true,
      rating: 4.0,
      reviews: 98,
      deliveryDate: "1-2 days",
      estimatedDelivery: "Jan 14-16, 2024",
    },
  ];

  // Similar products data
  const similarProducts = [
    {
      id: 3,
      name: "Snickers Bar",
      price: 30,
      image: "https://dummyimage.com/200x200/2F4F4F/FFFFFF&text=Snickers",
      category: "chocolates",
      rating: 4.2,
    },
    {
      id: 23,
      name: "Motichoor Laddu",
      price: 45,
      image: "https://dummyimage.com/200x200/FFA500/FFFFFF&text=Motichoor",
      category: "ladoos",
      rating: 4.4,
    },
    {
      id: 33,
      name: "Oreo Biscuits",
      price: 25,
      image: "https://dummyimage.com/200x200/000000/FFFFFF&text=Oreo",
      category: "biscuits",
      rating: 4.1,
    },
    {
      id: 43,
      name: "Vanilla Cake",
      price: 120,
      image: "https://dummyimage.com/200x200/FFF8DC/000000&text=Vanilla",
      category: "cakes",
      rating: 4.6,
    },
  ];

  useEffect(() => {
    // Simulate API call
    const fetchProduct = async () => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate loading

      const foundProduct = allProducts.find(
        (p) => p.id === parseInt(id || "0")
      );
      setProduct(foundProduct || null);
      setIsLoading(false);
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    // Add to cart functionality
    console.log("Added to cart:", { product, quantity });
    // In a real app, this would dispatch to Redux store
  };

  const handleQuantityChange = (change: number) => {
    setQuantity((prev) => Math.max(1, prev + change));
  };

  const handleFavorite = () => {
    if (product) {
      console.log(`Added ${product.name} to favorites!`);
      // Dispatch add to favorites action here
    }
  };

  const handleShare = () => {
    if (product) {
      console.log(`Sharing ${product.name}!`);
      // Implement share functionality here
      if (navigator.share) {
        navigator.share({
          title: product.name,
          text: `Check out this ${product.name} from CS Store!`,
          url: window.location.href,
        });
      } else {
        // Fallback for browsers that don't support Web Share API
        navigator.clipboard.writeText(window.location.href);
        alert("Product link copied to clipboard!");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Product Not Found
          </h1>
          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-6 w-6" />
            </motion.button>
            <h1 className="text-xl font-semibold text-gray-900">
              {product.name}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Media Section with Add to Cart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Product Images/Video with Overlay Icons */}
            <div className="relative w-full">
              {product.media && product.media.length > 0 ? (
                <ProductMediaCarousel
                  media={product.media}
                  className="w-full"
                />
              ) : (
                <div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              )}

              {/* Overlay Icons */}
              <div className="absolute top-4 right-4 flex flex-col space-y-2">
                {/* Favorite Icon */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleFavorite}
                  className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-all duration-200 group"
                  aria-label="Add to favorites"
                >
                  <Heart className="h-5 w-5 text-gray-600 group-hover:text-red-500 transition-colors" />
                </motion.button>

                {/* Share Icon */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleShare}
                  className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-all duration-200 group"
                  aria-label="Share product"
                >
                  <Share2 className="h-5 w-5 text-gray-600 group-hover:text-blue-500 transition-colors" />
                </motion.button>
              </div>
            </div>

            {/* Add to Cart Button - Moved under images */}
            <div className="space-y-4">
              {/* Quantity Selector */}
              <div className="flex items-center space-x-4">
                <span className="font-medium text-gray-700">Quantity:</span>
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleQuantityChange(-1)}
                    className="p-2 hover:bg-gray-100 transition-colors"
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </motion.button>
                  <span className="px-4 py-2 font-medium">{quantity}</span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleQuantityChange(1)}
                    className="p-2 hover:bg-gray-100 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>

              {/* Add to Cart Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddToCart}
                disabled={!product.inStock}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <ShoppingCart className="h-5 w-5" />
                <span>Add to Cart</span>
              </motion.button>
            </div>
          </motion.div>

          {/* Product Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Product Name */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {product.name}
              </h1>
            </div>

            {/* Product Rating */}
            {product.rating && (
              <div className="flex items-center space-x-2 mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(product.rating!)
                          ? "text-yellow-400 fill-current"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-lg font-semibold text-gray-700">
                  {product.rating}
                </span>
                <span className="text-gray-600">
                  ({product.reviews} reviews)
                </span>
              </div>
            )}

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-center space-x-3">
                <span className="text-4xl font-bold text-blue-600">
                  ₹{product.price}
                </span>
                {product.mrp && product.mrp > product.price && (
                  <span className="text-2xl text-gray-500 line-through">
                    ₹{product.mrp}
                  </span>
                )}
              </div>
              {product.mrp && product.mrp > product.price && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Save ₹{product.mrp - product.price}
                  </span>
                </div>
              )}
            </div>

            {/* Delivery Details */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3">
                <Truck className="h-6 w-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-800">
                    Delivery Information
                  </h3>
                  <p className="text-green-700">
                    Estimated delivery: {product.deliveryDate} (
                    {product.estimatedDelivery})
                  </p>
                </div>
              </div>
            </div>

            {/* Policy Information */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center space-x-3">
                <RotateCcw className="h-5 w-5 text-red-500" />
                <span className="text-gray-700 font-medium">
                  No Return Policy
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <CreditCard className="h-5 w-5 text-green-500" />
                <span className="text-gray-700 font-medium">
                  Cash on Delivery Available
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-blue-500" />
                <span className="text-gray-700 font-medium">
                  CS Store Assured
                </span>
              </div>
            </div>

            {/* Stock Status */}
            <div className="flex items-center space-x-2 mb-6">
              <div
                className={`w-3 h-3 rounded-full ${
                  product.inStock ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              <span
                className={`font-medium ${
                  product.inStock ? "text-green-700" : "text-red-700"
                }`}
              >
                {product.inStock ? "In Stock" : "Out of Stock"}
              </span>
            </div>

            {/* Features */}
            {product.features && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Key Features
                </h3>
                <ul className="space-y-2">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specifications */}
            {product.specifications && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Specifications
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <dl className="space-y-2">
                    {Object.entries(product.specifications).map(
                      ([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <dt className="font-medium text-gray-700">{key}:</dt>
                          <dd className="text-gray-600">{value}</dd>
                        </div>
                      )
                    )}
                  </dl>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Similar Products Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Similar Products
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {similarProducts.map((similarProduct) => (
              <motion.div
                key={similarProduct.id}
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/product/${similarProduct.id}`)}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
              >
                <div className="aspect-square mb-3">
                  <img
                    src={similarProduct.image}
                    alt={similarProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
                    {similarProduct.name}
                  </h3>
                  <div className="flex items-center space-x-1 mb-2">
                    <Star className="h-3 w-3 text-yellow-400 fill-current" />
                    <span className="text-xs text-gray-600">
                      {similarProduct.rating}
                    </span>
                  </div>
                  <p className="text-blue-600 font-bold text-sm">
                    ₹{similarProduct.price}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
