import React, { createContext, useContext, useState, ReactNode } from 'react';

// Import translations from JSON files
import en from '../locales/en.json';
import te from '../locales/te.json';
import hi from '../locales/hi.json';

export type Language = "en" | "te" | "hi";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

// Translation keys loaded from JSON files
const translations = { en, te, hi } as const;

function getNestedValue(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = obj as any;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

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
    const primary = getNestedValue(translations[language], key);
    const fallback = getNestedValue(translations.en, key);
    const value = (primary ?? fallback) ?? key;

    // If value is not a string (e.g., nested object), return the key
    if (typeof value !== 'string') {
      return key;
    }

    let translation = value;
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        translation = translation.replace(`{{${paramKey}}}`, paramValue);
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
