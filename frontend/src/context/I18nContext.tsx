import { createContext, PropsWithChildren, useContext, useMemo } from 'react';

type Locale = 'en' | 'tr';

type Dictionary = Record<string, Record<Locale, string>>;

const dictionary: Dictionary = {
  dashboard_overview_title: {
    en: 'Overview',
    tr: 'Genel Bakış'
  },
  dashboard_overview_description: {
    en: 'Monitor your trading posture and act on the latest AI-backed insights.',
    tr: 'Ticaret durumunu izle ve son yapay zeka içgörülerine göre aksiyon al.'
  },
  view_signals: {
    en: 'View Signals',
    tr: 'Sinyalleri Gör'
  },
  manage_portfolio: {
    en: 'Manage Portfolio',
    tr: 'Portföyü Yönet'
  },
  explore_signals: {
    en: 'Explore signals',
    tr: 'Sinyalleri incele'
  },
  review_portfolio: {
    en: 'Review portfolio',
    tr: 'Portföyü incele'
  }
};

interface I18nContextValue {
  locale: Locale;
  t: (key: keyof typeof dictionary) => string;
  switchLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider = ({ children }: PropsWithChildren) => {
  const value = useMemo<I18nContextValue>(() => {
    const translate = (key: keyof typeof dictionary) => dictionary[key]?.en ?? key;
    return {
      locale: 'en',
      t: translate,
      switchLocale: () => {}
    };
  }, []);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return ctx;
};
