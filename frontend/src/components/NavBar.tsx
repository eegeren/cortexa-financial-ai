import { useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

const NavBar = () => {
  const { token, email, logout } = useAuthStore((state) => ({
    token: state.token,
    email: state.email,
    logout: state.logout,
  }));
  const navigate = useNavigate();

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

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
      isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <>
      <aside className="hidden w-64 flex-col border-r border-outline/40 bg-canvas/80 px-4 pb-6 pt-10 backdrop-blur lg:flex">
        <button
          type="button"
          onClick={() => navigate(token ? '/assistant' : '/')}
          className="flex items-center gap-2 self-start rounded-xl border border-outline/50 px-3 py-2 text-left text-slate-300 transition hover:border-outline hover:text-white"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Cortexa</span>
          <span className="text-base font-semibold text-white">Trade</span>
        </button>

        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {(token ? authedLinks : publicLinks).map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass} onMouseEnter={() => prefetchRoute(link.to)}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-10 space-y-3 rounded-2xl border border-outline/30 bg-surface/60 p-4 text-sm text-slate-300">
          {token ? (
            <>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Account</p>
                <p className="mt-1 text-white">{email ?? 'Signed in'}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/settings')}
                onMouseEnter={() => prefetchRoute('/settings')}
                className="w-full rounded-lg border border-outline/30 px-3 py-2 text-left transition hover:border-outline hover:text-white"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => navigate('/billing')}
                onMouseEnter={() => prefetchRoute('/billing')}
                className="w-full rounded-lg border border-outline/30 px-3 py-2 text-left transition hover:border-outline hover:text-white"
              >
                Billing
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-lg border border-rose-400/40 px-3 py-2 text-left text-rose-300 transition hover:border-rose-400 hover:text-rose-200"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
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
            </>
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
              className={({ isActive }) =>
                `rounded-full px-3 py-1 transition ${isActive ? 'bg-white text-black' : 'hover:text-white'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
};

export default NavBar;
