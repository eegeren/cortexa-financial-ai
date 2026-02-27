import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

const NavBar = () => {
  const { token, email, logout } = useAuthStore((state) => ({
    token: state.token,
    email: state.email,
    logout: state.logout,
  }));
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const mobileAccountRef = useRef<HTMLDivElement | null>(null);

  const prefetchRoute = useCallback((path: string) => {
    const prefetched: Record<string, () => Promise<unknown>> = {
      '/assistant': () => import('@/pages/Assistant'),
      '/signals': () => import('@/pages/Signals'),
      '/dashboard': () => import('@/pages/Dashboard'),
      '/portfolio': () => import('@/pages/Portfolio'),
      '/forum': () => import('@/pages/Forum'),
      '/billing': () => import('@/pages/Billing'),
      '/settings': () => import('@/pages/Settings'),
      '/pricing': () => import('@/pages/Pricing'),
      '/login': () => import('@/pages/Login'),
      '/register': () => import('@/pages/Register'),
    };
    const action = prefetched[path];
    if (action) {
      void action();
    }
  }, []);

  const authedLinks = [
    { to: '/assistant', label: 'Assistant' },
    { to: '/signals', label: 'Signals' },
    { to: '/dashboard', label: 'Overview' },
    { to: '/portfolio', label: 'Portfolio' },
    { to: '/forum', label: 'Updates' },
  ];

  const publicLinks = [
    { to: '/pricing', label: 'Pricing' },
    { to: '/login', label: 'Log in' },
    { to: '/register', label: 'Sign up', highlight: true },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
      if (mobileAccountRef.current && !mobileAccountRef.current.contains(event.target as Node)) {
        setMobileAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
      isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <>
      <aside className="hidden w-56 flex-col border-r border-outline/40 bg-canvas/80 px-3 pb-6 pt-8 backdrop-blur lg:flex">
        <button
          type="button"
          onClick={() => navigate(token ? '/assistant' : '/')}
          className="flex items-center gap-2 self-start rounded-xl border border-outline/40 px-3 py-2 text-left text-slate-300 transition hover:border-outline hover:text-white"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Cortexa</span>
          <span className="text-base font-semibold text-white">Trade</span>
        </button>

        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {(token ? authedLinks : publicLinks).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={linkClass}
              onMouseEnter={() => prefetchRoute(link.to)}
              onClick={() => setAccountOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div ref={accountRef} className="relative mt-auto pt-6">
          {token ? (
            <>
              <button
                type="button"
                onClick={() => setAccountOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-outline/40 bg-surface/70 px-3 py-2 text-sm text-slate-200 transition hover:border-outline hover:text-white"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
              >
                <span className="truncate">{email ?? 'Account'}</span>
                <svg
                  aria-hidden
                  viewBox="0 0 12 8"
                  className={`h-3 w-3 transition-transform ${accountOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {accountOpen && (
                <div
                  role="menu"
                  className="absolute bottom-14 left-0 right-0 rounded-xl border border-outline/40 bg-surface p-2 text-sm text-slate-200 shadow-elevation-soft"
                >
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/settings');
                      setAccountOpen(false);
                    }}
                    onMouseEnter={() => prefetchRoute('/settings')}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition hover:bg-muted/60"
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/billing');
                      setAccountOpen(false);
                    }}
                    onMouseEnter={() => prefetchRoute('/billing')}
                    className="mt-1 flex w-full items-center rounded-lg px-3 py-2 transition hover:bg-muted/60"
                  >
                    Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      handleLogout();
                    }}
                    className="mt-1 flex w-full items-center rounded-lg px-3 py-2 text-rose-300 transition hover:bg-rose-500/10"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2 rounded-xl border border-outline/40 bg-surface/70 p-3 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-wide text-slate-500">Getting started</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                onMouseEnter={() => prefetchRoute('/login')}
                className="w-full rounded-lg border border-outline/30 px-3 py-2 text-left transition hover:border-outline hover:text-white"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                onMouseEnter={() => prefetchRoute('/register')}
                className="w-full rounded-lg border border-outline/30 px-3 py-2 text-left transition hover:border-outline hover:text-white"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </aside>

      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-outline/40 bg-canvas/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => navigate(token ? '/assistant' : '/')}
          className="flex items-center gap-2 text-left text-ink transition hover:text-white"
        >
          <span className="text-xs font-medium uppercase tracking-[0.42em] text-slate-400">Cortexa</span>
          <span className="text-base font-semibold text-white">Trade</span>
        </button>
        <div className="flex items-center gap-3 text-xs text-slate-300">
          {(token ? authedLinks : publicLinks).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onMouseEnter={() => prefetchRoute(link.to)}
              onClick={() => setMobileAccountOpen(false)}
              className={({ isActive }) =>
                `rounded-full px-3 py-1 transition ${isActive ? 'bg-white text-black' : 'hover:text-white'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
          {token && (
            <div ref={mobileAccountRef} className="relative">
              <button
                type="button"
                onClick={() => setMobileAccountOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-outline/60 px-3 py-1 text-ink transition hover:border-outline hover:text-white"
                aria-haspopup="menu"
                aria-expanded={mobileAccountOpen}
              >
                <span className="max-w-[120px] truncate">{email ?? 'Account'}</span>
                <svg
                  aria-hidden
                  viewBox="0 0 12 8"
                  className={`h-3 w-3 transition-transform ${mobileAccountOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {mobileAccountOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 rounded-xl border border-outline/40 bg-surface p-2 text-sm text-slate-200 shadow-elevation-soft"
                >
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/settings');
                      setMobileAccountOpen(false);
                    }}
                    onMouseEnter={() => prefetchRoute('/settings')}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition hover:bg-muted/60"
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/billing');
                      setMobileAccountOpen(false);
                    }}
                    onMouseEnter={() => prefetchRoute('/billing')}
                    className="mt-1 flex w-full items-center rounded-lg px-3 py-2 transition hover:bg-muted/60"
                  >
                    Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileAccountOpen(false);
                      handleLogout();
                    }}
                    className="mt-1 flex w-full items-center rounded-lg px-3 py-2 text-rose-300 transition hover:bg-rose-500/10"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default NavBar;
