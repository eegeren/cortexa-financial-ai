import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';

type ToastTone = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  createdAt: number;
}

interface ToastContextValue {
  pushToast: (message: string, tone?: ToastTone) => void;
  toasts: Toast[];
  history: Toast[];
  dismissToast: (id: number) => void;
  clearHistory: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastId = 0;

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [history, setHistory] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = ++toastId;
    const toast: Toast = { id, message, tone, createdAt: Date.now() };
    setToasts((prev) => [...prev, toast]);
    setHistory((prev) => [toast, ...prev].slice(0, 50));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setHistory((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const value = useMemo(
    () => ({ pushToast, toasts, history, dismissToast, clearHistory }),
    [pushToast, toasts, history, dismissToast, clearHistory]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-20 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full max-w-sm rounded-lg border px-4 py-2 text-sm shadow-lg transition ${
              toast.tone === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                : toast.tone === 'warning'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                : toast.tone === 'error'
                ? 'border-red-500/40 bg-red-500/10 text-red-100'
                : 'border-blue-500/40 bg-blue-500/10 text-blue-100'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx;
};
