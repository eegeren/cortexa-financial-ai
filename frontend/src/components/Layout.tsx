import { Helmet, HelmetProvider } from 'react-helmet-async';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import OnboardingTour from './OnboardingTour';
import { ThemeProvider } from '@/context/ThemeContext';
import { I18nProvider } from '@/context/I18nContext';
import { ToastProvider } from '@/components/ToastProvider';

const Layout = () => {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <HelmetProvider>
            <Helmet>
              <link rel="icon" href="/favicon.ico?v=3" />
              <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=3" />
              <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png?v=3" />
              <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=3" />
              <title>Cortexa Trade | Make Better Signals, Trade Smarter</title>
              <meta
                name="description"
                content="Cortexa Trade AI platform with assistant, signals, portfolio tools, and trading workflows."
              />
            </Helmet>
            <div className="relative h-[100dvh] overflow-hidden text-ink">
              <div className="pointer-events-none absolute inset-0 bg-grid-glow opacity-60" />
              <div className="pointer-events-none absolute inset-0 bg-glow-band opacity-40" />
              <div className="relative z-10 flex h-[100dvh] min-h-0 flex-col lg:flex-row">
                <NavBar />
                <main className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
                  <div className="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col">
                    <Outlet />
                  </div>
                </main>
                <OnboardingTour />
              </div>
            </div>
          </HelmetProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
};

export default Layout;
