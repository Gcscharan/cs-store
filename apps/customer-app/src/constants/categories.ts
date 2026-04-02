export const CATEGORIES = [ 
  { 
    name: "Chocolates", 
    image: require("../assets/images/chocolates.png"), 
  }, 
  { 
    name: "Biscuits", 
    image: require("../assets/images/biscuits.png"), 
  }, 
  { 
    name: "Chips", 
    image: require("../assets/images/chips.png"), 
  }, 
  { 
    name: "Drinks", 
    image: require("../assets/images/drinks.png"), 
  }, 
  { 
    name: "Hot Snacks", 
    image: require("../assets/images/hot-snacks.png"), 
  }, 
  { 
    name: "Ladoos", 
    image: require("../assets/images/ladoos.png"), 
  }, 
  { 
    name: "Sweets", 
    image: require("../assets/images/sweets.png"), 
  }, 
  { 
    name: "₹1 Items", 
    isTextTile: true,
    tileText: "₹1",
    tileSubtext: "DEALS",
    tileBg: "#FFF0E6",
    tileColor: "#E65C00",
  }, 
  { 
    name: "₹2 Items", 
    isTextTile: true,
    tileText: "₹2",
    tileSubtext: "DEALS",
    tileBg: "#EFF6FF",
    tileColor: "#2563EB",
  }, 
  { 
    name: "₹5 Items", 
    isTextTile: true,
    tileText: "₹5",
    tileSubtext: "DEALS",
    tileBg: "#F0FDF4",
    tileColor: "#16A34A",
  }, 
];

// For backward compatibility during migration if needed
export const CURATED_CATEGORIES = CATEGORIES;
