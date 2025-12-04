import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = "en" | "te" | "hi";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

// Translation keys
const translations = {
  en: {
    // Account page
    "account.title": "Account",
    "account.welcome": "Manage your account settings",
    "account.welcome.authenticated": "Welcome back, {{name}}!",
    "account.profile": "Profile",
    "account.profile.description": "Manage your personal information",
    "account.orders": "Orders",
    "account.orders.description": "View your order history",
    "account.settings": "Settings",
    "account.settings.description": "App preferences and configuration",
    "account.notifications": "Notifications",
    "account.notifications.description": "Manage your notification preferences",
    "account.privacy": "Privacy",
    "account.privacy.description": "Control your privacy settings",
    "account.help": "Help & Support",
    "account.help.description": "Get help and contact support",
    "account.logout": "Logout",
    "account.logout.description": "Sign out of your account",
    "account.language": "Language",
    "account.language.description": "Choose your preferred language",
    "account.language.english": "English",
    "account.language.telugu": "తెలుగు",
    "account.language.hindi": "हिन्दी",

    // Profile form
    "profile.edit": "Edit Profile",
    "profile.name": "Name",
    "profile.email": "Email",
    "profile.phone": "Phone",
    "profile.address": "Address",
    "profile.save": "Save Changes",
    "profile.cancel": "Cancel",

    // Common
    "common.shop_now": "Shop Now",
    "common.add_to_cart": "Add to Cart",
    "common.search": "Search",
    "common.cart": "Cart",
    "common.home": "Home",
    "common.categories": "Categories",
    "common.account": "Account",

    // Home page
    "home.for_you": "For You",
    "home.categories": "Categories",
    "home.end_of_products": "End of Products",
    "home.search_placeholder": "Search for products…",

    // Categories page
    "categories.title": "Categories",
    "categories.subtitle": "Browse products by category",
    "categories.chocolates": "Chocolates",
    "categories.ladoos": "Laddus",
    "categories.biscuits": "Biscuits",
    "categories.cakes": "Cakes",
    "categories.hot_snacks": "Hot Snacks",
    "categories.beverages": "Beverages",
    "categories.chocolates_desc": "Sweet chocolate treats",
    "categories.ladoos_desc": "Traditional Indian sweets",
    "categories.biscuits_desc": "Crispy and delicious biscuits",
    "categories.cakes_desc": "Delicious and fresh cakes",
    "categories.hot_snacks_desc": "Spicy and crispy snacks",
    "categories.beverages_desc": "Refreshing drinks and beverages",

    // Bottom navigation
    "nav.home": "Home",
    "nav.categories": "Categories",
    "nav.account": "Account",
    "nav.cart": "Cart",

    // Sorting
    "sort.title": "Sort by",
    "sort.price_low_high": "Price: Low to High",
    "sort.price_high_low": "Price: High to Low",
    "sort.popularity": "Popularity",
    "sort.newest": "Newest Arrivals",
    "sort.best_selling": "Best Selling",
  },
  te: {
    // Account page
    "account.title": "ఖాతా",
    "account.welcome": "మీ ఖాతా సెట్టింగ్‌లను నిర్వహించండి",
    "account.welcome.authenticated": "స్వాగతం, {{name}}!",
    "account.profile": "ప్రొఫైల్",
    "account.profile.description": "మీ వ్యక్తిగత సమాచారాన్ని నిర్వహించండి",
    "account.orders": "ఆర్డర్‌లు",
    "account.orders.description": "మీ ఆర్డర్ చరిత్రను చూడండి",
    "account.settings": "సెట్టింగ్‌లు",
    "account.settings.description": "అనువర్తన ప్రాధాన్యతలు మరియు కాన్ఫిగరేషన్",
    "account.notifications": "నోటిఫికేషన్‌లు",
    "account.notifications.description":
      "మీ నోటిఫికేషన్ ప్రాధాన్యతలను నిర్వహించండి",
    "account.privacy": "గోప్యత",
    "account.privacy.description": "మీ గోప్యత సెట్టింగ్‌లను నియంత్రించండి",
    "account.help": "సహాయం మరియు మద్దతు",
    "account.help.description": "సహాయం పొందండి మరియు మద్దతును సంప్రదించండి",
    "account.logout": "లాగ్ అవుట్",
    "account.logout.description": "మీ ఖాతా నుండి సైన్ అవుట్ చేయండి",
    "account.language": "భాష",
    "account.language.description": "మీ ఇష్టమైన భాషను ఎంచుకోండి",
    "account.language.english": "English",
    "account.language.telugu": "తెలుగు",
    "account.language.hindi": "हिन्दी",

    // Profile form
    "profile.edit": "ప్రొఫైల్‌ను సవరించండి",
    "profile.name": "పేరు",
    "profile.email": "ఇమెయిల్",
    "profile.phone": "ఫోన్",
    "profile.address": "చిరునామా",
    "profile.save": "మార్పులను సేవ్ చేయండి",
    "profile.cancel": "రద్దు చేయండి",

    // Common
    "common.shop_now": "ఇప్పుడు కొనండి",
    "common.add_to_cart": "కార్ట్‌కు జోడించండి",
    "common.search": "వెతకండి",
    "common.cart": "కార్ట్",
    "common.home": "హోమ్",
    "common.categories": "వర్గాలు",
    "common.account": "ఖాతా",

    // Home page
    "home.for_you": "మీ కోసం",
    "home.categories": "వర్గాలు",
    "home.end_of_products": "ఉత్పత్తుల ముగింపు",
    "home.search_placeholder": "ఉత్పత్తుల కోసం వెతకండి…",

    // Categories page
    "categories.title": "వర్గాలు",
    "categories.subtitle": "వర్గం ద్వారా ఉత్పత్తులను బ్రౌజ్ చేయండి",
    "categories.chocolates": "చాక్లెట్‌లు",
    "categories.ladoos": "లడ్డూలు",
    "categories.biscuits": "బిస్కెట్‌లు",
    "categories.cakes": "కేక్‌లు",
    "categories.hot_snacks": "వేడి స్నాక్‌లు",
    "categories.chocolates_desc": "మధుర చాక్లెట్ ట్రీట్‌లు",
    "categories.ladoos_desc": "సంప్రదాయ భారతీయ మిఠాయిలు",
    "categories.biscuits_desc": "క్రిస్పీ మరియు రుచికరమైన బిస్కెట్‌లు",
    "categories.cakes_desc": "రుచికరమైన మరియు తాజా కేక్‌లు",
    "categories.hot_snacks_desc": "అల్పాహారం మరియు క్రిస్పీ స్నాక్‌లు",

    // Bottom navigation
    "nav.home": "హోమ్",
    "nav.categories": "వర్గాలు",
    "nav.account": "ఖాతా",
    "nav.cart": "కార్ట్",

    // Sorting
    "sort.title": "వరుస క్రమం",
    "sort.price_low_high": "ధర: తక్కువ నుండి ఎక్కువ",
    "sort.price_high_low": "ధర: ఎక్కువ నుండి తక్కువ",
    "sort.popularity": "జనాదరణ",
    "sort.newest": "కొత్త వస్తువులు",
    "sort.best_selling": "అత్యధిక అమ్మకాలు",
  },
  hi: {
    // Account page
    "account.title": "खाता",
    "account.welcome": "अपनी खाता सेटिंग्स प्रबंधित करें",
    "account.welcome.authenticated": "स्वागत है, {{name}}!",
    "account.profile": "प्रोफ़ाइल",
    "account.profile.description": "अपनी व्यक्तिगत जानकारी प्रबंधित करें",
    "account.orders": "ऑर्डर",
    "account.orders.description": "अपना ऑर्डर इतिहास देखें",
    "account.settings": "सेटिंग्स",
    "account.settings.description": "ऐप प्राथमिकताएं और कॉन्फ़िगरेशन",
    "account.notifications": "सूचनाएं",
    "account.notifications.description":
      "अपनी सूचना प्राथमिकताएं प्रबंधित करें",
    "account.privacy": "गोपनीयता",
    "account.privacy.description": "अपनी गोपनीयता सेटिंग्स नियंत्रित करें",
    "account.help": "सहायता और समर्थन",
    "account.help.description": "सहायता प्राप्त करें और समर्थन से संपर्क करें",
    "account.logout": "लॉग आउट",
    "account.logout.description": "अपने खाते से साइन आउट करें",
    "account.language": "भाषा",
    "account.language.description": "अपनी पसंदीदा भाषा चुनें",
    "account.language.english": "English",
    "account.language.telugu": "తెలుగు",
    "account.language.hindi": "हिन्दी",

    // Profile form
    "profile.edit": "प्रोफ़ाइल संपादित करें",
    "profile.name": "नाम",
    "profile.email": "ईमेल",
    "profile.phone": "फोन",
    "profile.address": "पता",
    "profile.save": "परिवर्तन सहेजें",
    "profile.cancel": "रद्द करें",

    // Common
    "common.shop_now": "अभी खरीदें",
    "common.add_to_cart": "कार्ट में जोड़ें",
    "common.search": "खोजें",
    "common.cart": "कार्ट",
    "common.home": "होम",
    "common.categories": "श्रेणियां",
    "common.account": "खाता",

    // Home page
    "home.for_you": "आपके लिए",
    "home.categories": "श्रेणियां",
    "home.end_of_products": "उत्पादों का अंत",
    "home.search_placeholder": "उत्पादों के लिए खोजें…",

    // Categories page
    "categories.title": "श्रेणियां",
    "categories.subtitle": "श्रेणी के अनुसार उत्पाद ब्राउज़ करें",
    "categories.chocolates": "चॉकलेट",
    "categories.ladoos": "लड्डू",
    "categories.biscuits": "बिस्कुट",
    "categories.cakes": "केक",
    "categories.hot_snacks": "हॉट स्नैक्स",
    "categories.chocolates_desc": "मीठे चॉकलेट ट्रीट्स",
    "categories.ladoos_desc": "पारंपरिक भारतीय मिठाई",
    "categories.biscuits_desc": "कुरकुरे और स्वादिष्ट बिस्कुट",
    "categories.cakes_desc": "स्वादिष्ट और ताजे केक",
    "categories.hot_snacks_desc": "मसालेदार और कुरकुरे स्नैक्स",

    // Bottom navigation
    "nav.home": "होम",
    "nav.categories": "श्रेणियां",
    "nav.account": "खाता",
    "nav.cart": "कार्ट",

    // Sorting
    "sort.title": "क्रमबद्ध करें",
    "sort.price_low_high": "मूल्य: कम से ज्यादा",
    "sort.price_high_low": "मूल्य: ज्यादा से कम",
    "sort.popularity": "लोकप्रियता",
    "sort.newest": "नवीनतम आगमन",
    "sort.best_selling": "सबसे ज्यादा बिकने वाले",
  },
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("app-language");
    return (saved as Language) || "en";
  });

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    localStorage.setItem("app-language", newLanguage);
  };

  const t = (key: string, params?: Record<string, string>): string => {
    let translation =
      translations[language][
        key as keyof (typeof translations)[typeof language]
      ] || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(`{{${paramKey}}}`, value);
      });
    }

    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
