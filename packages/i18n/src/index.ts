import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import te from './locales/te.json';
import hi from './locales/hi.json';

export const resources = {
  en: { translation: en },
  te: { translation: te },
  hi: { translation: hi }
};

export const defaultNS = 'translation';

export const initI18n = (language = 'en') => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: 'en',
      defaultNS,
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
  }
  return i18n;
};

export { i18n };
export { useTranslation } from 'react-i18next';
export { Trans } from 'react-i18next';
