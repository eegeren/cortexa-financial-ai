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
            <title>Cortexa Trade</title>
          </Helmet>
            <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50 transition-[background-color] duration-300 dark:bg-slate-950">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-[-20%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute right-[-10%] bottom-[-25%] h-[380px] w-[380px] rounded-full bg-accent/10 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.2),_transparent_60%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(15,23,42,0.4)_0%,_transparent_40%)]" />
            </div>
            <div className="relative z-10">
              <NavBar />
              <main className="mx-auto w-full max-w-7xl px-4 py-8">
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
