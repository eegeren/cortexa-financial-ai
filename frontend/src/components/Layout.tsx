import { Helmet, HelmetProvider } from 'react-helmet-async';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import NavBar from './NavBar';
import OnboardingTour from './OnboardingTour';
import { ThemeProvider } from '@/context/ThemeContext';
import { I18nProvider } from '@/context/I18nContext';
import { ToastProvider } from '@/components/ToastProvider';

const Layout = () => {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const isAssistantViewportRoute = location.pathname === '/assistant';
  const isLandingRoute = location.pathname === '/' && !token;
  const shouldReduceAmbientEffects = isLandingRoute;

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
            <div className="relative min-h-[100dvh] overflow-x-clip text-ink lg:h-[100dvh] lg:overflow-hidden">
              {!shouldReduceAmbientEffects && <div className="pointer-events-none absolute inset-0 bg-grid-glow opacity-60" />}
              {!shouldReduceAmbientEffects && <div className="pointer-events-none absolute inset-0 bg-glow-band opacity-40" />}
              <div className="relative z-10 flex min-h-[100dvh] flex-col lg:h-[100dvh] lg:min-h-0 lg:flex-row">
                {!isLandingRoute && <NavBar />}
                <main className={`flex-1 min-h-0 min-w-0 overflow-x-clip ${isLandingRoute ? 'px-0 py-0' : 'px-3 py-3 sm:px-5 sm:py-4 lg:px-8 lg:py-6'} ${
                  isAssistantViewportRoute ? 'overflow-y-auto lg:overflow-y-hidden' : 'overflow-y-auto'
                }`}>
                  <div className={`flex min-h-full w-full flex-col overflow-visible ${isLandingRoute ? 'max-w-none' : 'mx-auto max-w-[1400px]'}`}>
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
