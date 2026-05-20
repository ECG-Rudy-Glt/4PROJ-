import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import fr from './fr.json';
import en from './en.json';

const deviceLang = Localization.getLocales?.()?.[0]?.languageCode ?? 'fr';

i18n
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr }, en: { translation: en } },
    lng: deviceLang === 'en' ? 'en' : 'fr',
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;

export function setLanguage(lang: 'fr' | 'en') {
  i18n.changeLanguage(lang);
}
