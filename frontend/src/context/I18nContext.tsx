import { createContext, PropsWithChildren, useContext, useMemo } from 'react';

type Locale = 'en' | 'tr';

type Dictionary = Record<string, Record<Locale, string>>;

const dictionary: Dictionary = {
  dashboard_overview_title: {
    en: 'Overview',
    tr: 'Overview'
  },
  dashboard_overview_description: {
    en: 'Monitor your trading posture and act on the latest AI-backed insights.',
    tr: 'Monitor your trading posture and act on the latest AI-backed insights.'
  },
  view_signals: {
    en: 'View Signals',
    tr: 'View Signals'
  },
  manage_portfolio: {
    en: 'Manage Portfolio',
    tr: 'Manage Portfolio'
  },
  explore_signals: {
    en: 'Explore signals',
    tr: 'Explore signals'
  },
  review_portfolio: {
    en: 'Review portfolio',
    tr: 'Review portfolio'
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
