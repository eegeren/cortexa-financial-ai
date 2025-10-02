import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AppProviders from './components/AppProviders';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}
rootElement.setAttribute('suppressHydrationWarning', 'true');

const HydrationShell = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    if (typeof document !== 'undefined') {
      document.body.style.backgroundColor = '#020617';
      document.body.style.color = '#e2e8f0';
    }
  }, []);

  return (
    <BrowserRouter>
      <AppProviders>
        {ready ? (
          <App />
        ) : (
          <div className="flex min-h-screen items-center justify-center bg-slate-950">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-800 border-t-primary" />
          </div>
        )}
      </AppProviders>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(rootElement as HTMLElement).render(
  <React.StrictMode>
    <HydrationShell />
  </React.StrictMode>
);
