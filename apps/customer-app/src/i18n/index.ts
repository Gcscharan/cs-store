import 'intl';
import 'intl/locale-data/jsonp/en';
import 'intl/locale-data/jsonp/hi';
import 'intl/locale-data/jsonp/te';
import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resources } from '@vyaparsetu/i18n';

const LANGUAGE_DETECTOR = { 
  type: 'languageDetector' as const, 
  async: true, 
  detect: async (callback: (lang: string) => void) => { 
    try { 
      const savedLanguage = await AsyncStorage.getItem('user-language'); 
      callback(savedLanguage || 'en'); 
    } catch { 
      callback('en'); 
    } 
  }, 
  init: () => {}, 
  cacheUserLanguage: async (language: string) => { 
    await AsyncStorage.setItem('user-language', language); 
  }, 
}; 
 
if (!i18n.isInitialized) { 
  i18n 
    .use(LANGUAGE_DETECTOR) 
    .use(initReactI18next) 
    .init({ 
      resources, 
      fallbackLng: 'en', 
      compatibilityJSON: 'v3',   // 🔥 important 
      interpolation: { 
        escapeValue: false, 
      }, 
      react: { 
        useSuspense: false, 
      }, 
    }); 
} 

export default i18n;
