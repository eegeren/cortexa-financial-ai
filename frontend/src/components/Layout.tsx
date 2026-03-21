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
            <div className="relative min-h-screen overflow-hidden text-ink">
              <div className="pointer-events-none absolute inset-0 bg-grid-glow opacity-60" />
              <div className="pointer-events-none absolute inset-0 bg-glow-band opacity-40" />
              <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
                <NavBar />
                <main className="flex-1 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
                  <div className="mx-auto w-full max-w-[1320px]">
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
