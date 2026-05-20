import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Lang } from '../i18n/translations';
import i18n from '../i18n';

interface I18nState {
  lang: Lang;
  t: typeof translations['fr'];
  setLang: (lang: Lang) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      lang: 'fr',
      t: translations.fr,
      setLang: (lang: Lang) => {
        i18n.changeLanguage(lang);
        set({ lang, t: translations[lang] });
      },
    }),
    {
      name: 'i18n-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lang: state.lang }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.t = translations[state.lang];
          i18n.changeLanguage(state.lang);
        }
      },
    }
  )
);
