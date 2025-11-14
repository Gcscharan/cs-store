import mongoose from "mongoose";
import { Product } from "../src/models/Product";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store";

const productData = [
  // Chocolates
  {
    name: "Cadbury Dairy Milk",
    description:
      "Rich and creamy milk chocolate bar that melts in your mouth. Perfect for sharing or enjoying alone. Made with real milk and premium cocoa beans.",
    category: "chocolates",
    price: 25,
    mrp: 35,
    stock: 100,
    images: ["https://dummyimage.com/400x400/8B4513/FFFFFF&text=Cadbury"],
    tags: ["chocolate", "milk", "premium", "popular"],
  },
  {
    name: "KitKat 4 Finger",
    description:
      "Crispy wafer fingers covered in smooth milk chocolate. Break it, share it, enjoy it! Perfect for a quick break with friends.",
    category: "chocolates",
    price: 20,
    mrp: 25,
    stock: 80,
    images: ["https://dummyimage.com/400x400/FF6347/FFFFFF&text=KitKat"],
    tags: ["wafer", "chocolate", "crispy", "break"],
  },
  {
    name: "Snickers Bar",
    description:
      "Packed with roasted peanuts, nougat, caramel and milk chocolate, Snickers handles your hunger so you can handle anything.",
    category: "chocolates",
    price: 30,
    mrp: 40,
    stock: 75,
    images: ["https://dummyimage.com/400x400/2F4F4F/FFFFFF&text=Snickers"],
    tags: ["peanuts", "caramel", "nougat", "filling"],
  },
  {
    name: "Mars Bar",
    description:
      "A delicious blend of chocolate, caramel and nougat. The perfect combination of flavors that satisfies your sweet cravings.",
    category: "chocolates",
    price: 25,
    mrp: 35,
    stock: 60,
    images: ["https://dummyimage.com/400x400/DC143C/FFFFFF&text=Mars"],
    tags: ["caramel", "nougat", "chocolate", "classic"],
  },
  {
    name: "Twix Bar",
    description:
      "Crunchy biscuit, chewy caramel, and smooth chocolate. Two fingers of pure indulgence that you can enjoy anytime.",
    category: "chocolates",
    price: 22,
    mrp: 30,
    stock: 70,
    images: ["https://dummyimage.com/400x400/DAA520/FFFFFF&text=Twix"],
    tags: ["biscuit", "caramel", "chocolate", "crunchy"],
  },
  {
    name: "Bounty Bar",
    description:
      "Moist tender coconut covered in thick milk chocolate. A tropical paradise in every bite that transports you to coconut groves.",
    category: "chocolates",
    price: 28,
    mrp: 38,
    stock: 50,
    images: ["https://dummyimage.com/400x400/228B22/FFFFFF&text=Bounty"],
    tags: ["coconut", "chocolate", "tropical", "moist"],
  },
  {
    name: "Milky Way",
    description:
      "Light whipped nougat covered in milk chocolate. A heavenly combination that melts in your mouth with every bite.",
    category: "chocolates",
    price: 24,
    mrp: 32,
    stock: 65,
    images: ["https://dummyimage.com/400x400/4682B4/FFFFFF&text=Milky"],
    tags: ["nougat", "chocolate", "light", "whipped"],
  },
  {
    name: "Galaxy Smooth",
    description:
      "Smooth milk chocolate that melts in your mouth. Indulge in the silky smooth taste of Galaxy chocolate for a premium experience.",
    category: "chocolates",
    price: 35,
    mrp: 45,
    stock: 40,
    images: ["https://dummyimage.com/400x400/800080/FFFFFF&text=Galaxy"],
    tags: ["smooth", "premium", "milk", "chocolate"],
  },
  {
    name: "Ferrero Rocher",
    description:
      "A whole hazelnut encased in a thin wafer shell, filled with hazelnut chocolate, covered in milk chocolate and chopped hazelnuts.",
    category: "chocolates",
    price: 45,
    mrp: 60,
    stock: 30,
    images: ["https://dummyimage.com/400x400/FFD700/000000&text=Ferrero"],
    tags: ["hazelnut", "premium", "wafer", "luxury"],
  },
  {
    name: "Toblerone",
    description:
      "Swiss milk chocolate with honey and almond nougat. The unique triangular shape and rich taste make it a perfect gift.",
    category: "chocolates",
    price: 50,
    mrp: 70,
    stock: 25,
    images: ["https://dummyimage.com/400x400/FF4500/FFFFFF&text=Toblerone"],
    tags: ["swiss", "honey", "almond", "nougat"],
  },

  // Biscuits
  {
    name: "Parle-G Biscuits",
    description:
      "India's favorite biscuit. G for Genius. The original glucose biscuit that has been a household name for generations.",
    category: "biscuits",
    price: 10,
    mrp: 15,
    stock: 200,
    images: ["https://dummyimage.com/400x400/FFD700/000000&text=Parle-G"],
    tags: ["glucose", "classic", "indian", "popular"],
  },
  {
    name: "Oreo Cookies",
    description:
      "Chocolate sandwich cookie with a sweet, creamy filling. Twist, lick, dunk - the world's favorite way to enjoy cookies.",
    category: "biscuits",
    price: 30,
    mrp: 40,
    stock: 90,
    images: ["https://dummyimage.com/400x400/000000/FFFFFF&text=Oreo"],
    tags: ["chocolate", "cream", "sandwich", "classic"],
  },
  {
    name: "Good Day Biscuits",
    description:
      "Have a good day with these delicious biscuits. Rich butter cookies with a melt-in-your-mouth texture that brightens any moment.",
    category: "biscuits",
    price: 15,
    mrp: 20,
    stock: 120,
    images: ["https://dummyimage.com/400x400/FF8C00/FFFFFF&text=Good+Day"],
    tags: ["butter", "cookies", "delicious", "melt"],
  },
  {
    name: "Marie Gold",
    description:
      "Light and crispy tea-time biscuits, perfect with a cup of chai. The ideal companion for your evening tea ritual.",
    category: "biscuits",
    price: 12,
    mrp: 18,
    stock: 150,
    images: ["https://dummyimage.com/400x400/FFA500/FFFFFF&text=Marie"],
    tags: ["light", "crispy", "tea", "gold"],
  },
  {
    name: "Monaco Salted",
    description:
      "Salted crackers perfect for tea time. Crispy, salty, and satisfying - the perfect savory snack for any time of day.",
    category: "biscuits",
    price: 8,
    mrp: 12,
    stock: 180,
    images: ["https://dummyimage.com/400x400/32CD32/FFFFFF&text=Monaco"],
    tags: ["salted", "crackers", "crispy", "savory"],
  },
  {
    name: "Hide & Seek",
    description:
      "Chocolate chip cookies with hidden chocolate chips. A delightful surprise in every bite that kids and adults love.",
    category: "biscuits",
    price: 25,
    mrp: 35,
    stock: 85,
    images: ["https://dummyimage.com/400x400/FF1493/FFFFFF&text=Hide+Seek"],
    tags: ["chocolate", "chips", "cookies", "hidden"],
  },
  {
    name: "Coconut Cookies",
    description:
      "Delicious coconut flavored cookies with a tropical twist. Perfect for those who love the taste of fresh coconut.",
    category: "biscuits",
    price: 18,
    mrp: 25,
    stock: 70,
    images: ["https://dummyimage.com/400x400/8FBC8F/FFFFFF&text=Coconut"],
    tags: ["coconut", "tropical", "flavored", "cookies"],
  },
  {
    name: "Digestive Biscuits",
    description:
      "Healthy digestive biscuits for better digestion. Made with whole wheat and natural ingredients for a wholesome snack.",
    category: "biscuits",
    price: 20,
    mrp: 28,
    stock: 95,
    images: ["https://dummyimage.com/400x400/D2691E/FFFFFF&text=Digestive"],
    tags: ["digestive", "healthy", "wholewheat", "natural"],
  },
  {
    name: "Cream Biscuits",
    description:
      "Soft and creamy biscuits with vanilla flavor. A delightful treat that melts in your mouth with every bite.",
    category: "biscuits",
    price: 22,
    mrp: 30,
    stock: 60,
    images: ["https://dummyimage.com/400x400/FFB6C1/000000&text=Cream"],
    tags: ["cream", "vanilla", "soft", "delicate"],
  },
  {
    name: "Chocolate Biscuits",
    description:
      "Rich chocolate flavored biscuits for chocolate lovers. Indulge in the deep chocolate taste that satisfies your cravings.",
    category: "biscuits",
    price: 28,
    mrp: 38,
    stock: 55,
    images: ["https://dummyimage.com/400x400/8B4513/FFFFFF&text=Choco"],
    tags: ["chocolate", "rich", "flavored", "indulgent"],
  },

  // Ladoos
  {
    name: "Besan Laddu",
    description:
      "Traditional Indian sweet made from gram flour, ghee, and sugar. A melt-in-your-mouth delicacy that brings back childhood memories.",
    category: "ladoos",
    price: 40,
    mrp: 55,
    stock: 80,
    images: ["https://dummyimage.com/400x400/FFD700/000000&text=Besan"],
    tags: ["traditional", "indian", "sweet", "gramflour"],
  },
  {
    name: "Coconut Laddu",
    description:
      "Sweet and fragrant coconut ladoos made with fresh coconut. A tropical delight that's perfect for festivals and celebrations.",
    category: "ladoos",
    price: 35,
    mrp: 48,
    stock: 70,
    images: ["https://dummyimage.com/400x400/FFFFFF/000000&text=Coconut"],
    tags: ["coconut", "fragrant", "tropical", "festival"],
  },
  {
    name: "Motichoor Laddu",
    description:
      "Premium ladoos made with fine boondi and aromatic spices. The king of ladoos with its tiny pearl-like texture and rich flavor.",
    category: "ladoos",
    price: 45,
    mrp: 60,
    stock: 50,
    images: ["https://dummyimage.com/400x400/FFA500/FFFFFF&text=Motichoor"],
    tags: ["premium", "boondi", "spices", "pearls"],
  },
  {
    name: "Rava Laddu",
    description:
      "Semolina ladoos with nuts and raisins. A popular and easy-to-make Indian sweet that's perfect for any occasion.",
    category: "ladoos",
    price: 38,
    mrp: 50,
    stock: 65,
    images: ["https://dummyimage.com/400x400/F5DEB3/000000&text=Rava"],
    tags: ["semolina", "nuts", "raisins", "popular"],
  },
  {
    name: "Til Laddu",
    description:
      "Sesame seed ladoos with jaggery. A nutritious and traditional winter sweet that provides warmth and energy.",
    category: "ladoos",
    price: 42,
    mrp: 55,
    stock: 45,
    images: ["https://dummyimage.com/400x400/8B4513/FFFFFF&text=Til"],
    tags: ["sesame", "jaggery", "nutritious", "winter"],
  },
  {
    name: "Dry Fruit Laddu",
    description:
      "Healthy and energy-boosting ladoos made with assorted dry fruits. A perfect combination of taste and nutrition.",
    category: "ladoos",
    price: 60,
    mrp: 80,
    stock: 35,
    images: ["https://dummyimage.com/400x400/DEB887/000000&text=Dry+Fruit"],
    tags: ["dryfruits", "healthy", "energy", "nutritious"],
  },
  {
    name: "Gond Laddu",
    description:
      "Traditional ladoos made with edible gum and nuts. A winter special that provides warmth and strength to the body.",
    category: "ladoos",
    price: 50,
    mrp: 65,
    stock: 40,
    images: ["https://dummyimage.com/400x400/D2691E/FFFFFF&text=Gond"],
    tags: ["gum", "nuts", "traditional", "winter"],
  },
  {
    name: "Churma Laddu",
    description:
      "Sweet ladoos made with wheat flour and ghee. A rustic delicacy that brings the authentic taste of village sweets.",
    category: "ladoos",
    price: 48,
    mrp: 62,
    stock: 55,
    images: ["https://dummyimage.com/400x400/CD853F/FFFFFF&text=Churma"],
    tags: ["wheat", "ghee", "rustic", "village"],
  },
  {
    name: "Kaju Laddu",
    description:
      "Cashew nut ladoos with cardamom flavor. A premium sweet that's perfect for special occasions and celebrations.",
    category: "ladoos",
    price: 55,
    mrp: 70,
    stock: 30,
    images: ["https://dummyimage.com/400x400/FFE4B5/000000&text=Kaju"],
    tags: ["cashew", "cardamom", "premium", "special"],
  },
  {
    name: "Badam Laddu",
    description:
      "Almond ladoos with saffron and cardamom. A royal treat that combines the goodness of almonds with aromatic spices.",
    category: "ladoos",
    price: 65,
    mrp: 85,
    stock: 25,
    images: ["https://dummyimage.com/400x400/F0E68C/000000&text=Badam"],
    tags: ["almond", "saffron", "cardamom", "royal"],
  },

  // Cakes
  {
    name: "Chocolate Cake",
    description:
      "Rich and moist chocolate cake perfect for celebrations. Made with premium cocoa and fresh ingredients for the ultimate chocolate experience.",
    category: "cakes",
    price: 150,
    mrp: 200,
    stock: 20,
    images: ["https://dummyimage.com/400x400/8B4513/FFFFFF&text=Choco+Cake"],
    tags: ["chocolate", "moist", "celebration", "premium"],
  },
  {
    name: "Vanilla Cake",
    description:
      "Classic vanilla cake with smooth buttercream frosting. A timeless favorite that's perfect for any occasion with its delicate vanilla flavor.",
    category: "cakes",
    price: 120,
    mrp: 160,
    stock: 25,
    images: ["https://dummyimage.com/400x400/F5F5DC/000000&text=Vanilla"],
    tags: ["vanilla", "classic", "buttercream", "timeless"],
  },
  {
    name: "Strawberry Cake",
    description:
      "Fresh strawberry cake with cream filling. A fruity delight that combines the sweetness of strawberries with creamy goodness.",
    category: "cakes",
    price: 140,
    mrp: 180,
    stock: 18,
    images: ["https://dummyimage.com/400x400/FF69B4/FFFFFF&text=Strawberry"],
    tags: ["strawberry", "fresh", "fruity", "cream"],
  },
  {
    name: "Red Velvet Cake",
    description:
      "Classic red velvet cake with cream cheese frosting. A sophisticated dessert with its distinctive red color and velvety texture.",
    category: "cakes",
    price: 160,
    mrp: 220,
    stock: 15,
    images: ["https://dummyimage.com/400x400/DC143C/FFFFFF&text=Red+Velvet"],
    tags: ["redvelvet", "creamcheese", "sophisticated", "velvety"],
  },
  {
    name: "Cheese Cake",
    description:
      "Creamy cheesecake with berry topping. A rich and indulgent dessert that's perfect for special occasions and celebrations.",
    category: "cakes",
    price: 180,
    mrp: 240,
    stock: 12,
    images: ["https://dummyimage.com/400x400/FFE4B5/000000&text=Cheese"],
    tags: ["cheesecake", "creamy", "berries", "indulgent"],
  },

  // Hot Snacks
  {
    name: "Samosa",
    description:
      "Crispy fried pastry filled with spiced potatoes and peas. A popular Indian snack that's perfect with tea or as an appetizer.",
    category: "hot_snacks",
    price: 15,
    mrp: 20,
    stock: 100,
    images: ["https://dummyimage.com/400x400/D2691E/FFFFFF&text=Samosa"],
    tags: ["crispy", "spiced", "potato", "popular"],
  },
  {
    name: "Pakora",
    description:
      "Crispy vegetable fritters perfect with tea. A monsoon favorite that brings warmth and comfort with every bite.",
    category: "hot_snacks",
    price: 20,
    mrp: 28,
    stock: 80,
    images: ["https://dummyimage.com/400x400/228B22/FFFFFF&text=Pakora"],
    tags: ["vegetable", "fritters", "crispy", "monsoon"],
  },
  {
    name: "Vada",
    description:
      "Crispy lentil fritters with coconut chutney. A South Indian delicacy that's perfect for breakfast or as a snack.",
    category: "hot_snacks",
    price: 12,
    mrp: 18,
    stock: 90,
    images: ["https://dummyimage.com/400x400/FFD700/000000&text=Vada"],
    tags: ["lentil", "crispy", "southindian", "chutney"],
  },
  {
    name: "Bonda",
    description:
      "Spiced potato balls coated in gram flour batter. A delicious snack that's crispy on the outside and soft on the inside.",
    category: "hot_snacks",
    price: 18,
    mrp: 25,
    stock: 75,
    images: ["https://dummyimage.com/400x400/CD853F/FFFFFF&text=Bonda"],
    tags: ["potato", "spiced", "crispy", "soft"],
  },
  {
    name: "Kachori",
    description:
      "Flaky pastry filled with spiced lentil mixture. A North Indian specialty that's perfect for breakfast or evening snacks.",
    category: "hot_snacks",
    price: 16,
    mrp: 22,
    stock: 85,
    images: ["https://dummyimage.com/400x400/FF8C00/FFFFFF&text=Kachori"],
    tags: ["flaky", "lentil", "spiced", "northindian"],
  },
];

async function seedProducts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing products
    await Product.deleteMany({});
    console.log("Cleared existing products");

    // Insert new products
    const products = await Product.insertMany(productData);
    console.log(`Seeded ${products.length} products successfully`);

    process.exit(0);
  } catch (error) {
    console.error("Error seeding products:", error);
    process.exit(1);
  }
}

seedProducts();
