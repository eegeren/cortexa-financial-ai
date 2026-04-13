import React, { Suspense, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import App from './App';
import AppProviders from './components/AppProviders';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}
rootElement.setAttribute('suppressHydrationWarning', 'true');

const AppSkeleton = () => (
  <div className="flex min-h-screen items-center justify-center bg-canvas text-slate-300">
    <div className="h-9 w-9 animate-spin rounded-full border-2 border-outline/60 border-t-primary" />
  </div>
);

const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas text-slate-200">
    <div className="text-lg font-semibold text-rose-200">Something went wrong.</div>
    <pre className="max-w-lg whitespace-pre-wrap rounded-lg bg-surface px-4 py-3 text-xs text-slate-400">
      {error.message}
    </pre>
    <button
      type="button"
      onClick={() => {
        resetErrorBoundary();
        window.location.reload();
      }}
      className="rounded-full border border-outline/50 px-4 py-2 text-sm text-slate-200 transition hover:border-outline hover:text-white"
    >
      Reload page
    </button>
  </div>
);

const HydrationShell = () => {
  const basename = import.meta.env.BASE_URL ?? '/';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.style.backgroundColor = '#0d0d0d';
      document.body.style.color = '#f4f4f5';
    }
  }, []);

  return (
    <BrowserRouter basename={basename}>
      <AppProviders>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Suspense fallback={<AppSkeleton />}>
            <App />
          </Suspense>
        </ErrorBoundary>
      </AppProviders>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(rootElement as HTMLElement).render(
  <React.StrictMode>
    <HydrationShell />
  </React.StrictMode>
);
