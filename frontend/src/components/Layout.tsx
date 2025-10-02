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
            <meta name="description" content="Cortexa Trade AI platform — smarter trading with signals, portfolio tools, and a new Forum community." />
          </Helmet>
            <div className="relative min-h-screen overflow-hidden bg-canvas text-ink transition-[background-color] duration-500">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-[-10%] top-[-20%] h-[420px] w-[420px] rounded-full bg-primary/25 blur-3xl opacity-60" />
              <div className="absolute right-[-15%] top-[20%] h-[360px] w-[360px] rounded-full bg-accent/20 blur-[120px] opacity-70" />
              <div className="absolute inset-x-0 top-1/3 h-[280px] bg-glow-band opacity-80 blur-[110px]" />
              <div className="absolute inset-0 bg-grid-glow opacity-80" />
            </div>
            <div className="relative z-10">
              <NavBar />
              <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6">
                <Outlet />
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
