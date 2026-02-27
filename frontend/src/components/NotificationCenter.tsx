import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';

const NotificationCenter = () => {
  const { history, dismissToast, clearHistory } = useToast();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative"> 
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-primary hover:text-white"
      >
        🔔
        {history.length > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
            {history.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-[200] mt-3 w-80 rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Notifications</p>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearHistory();
                  setOpen(false);
                }}
                className="text-xs text-slate-400 transition hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
          <div className="mt-3 max-h-64 overflow-y-auto space-y-3 text-sm text-slate-200">
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">You have no notifications yet.</p>
            ) : (
              history.map((toast) => (
                <div
                  key={toast.id}
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    toast.tone === 'success'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                      : toast.tone === 'warning'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                      : toast.tone === 'error'
                      ? 'border-red-500/40 bg-red-500/10 text-red-100'
                      : 'border-blue-500/40 bg-blue-500/10 text-blue-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[13px]">{toast.message}</p>
                    <button
                      type="button"
                      onClick={() => dismissToast(toast.id)}
                      className="text-[10px] uppercase tracking-wide text-slate-200 transition hover:text-white"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-300">
                    {new Date(toast.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
