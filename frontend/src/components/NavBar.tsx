import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import NotificationCenter from '@/components/NotificationCenter';
import useSubscriptionAccess from '@/hooks/useSubscriptionAccess';
import { useAuthStore } from '@/store/auth';

const NavBar = () => {
  const { token, email, logout } = useAuthStore((state) => ({
    token: state.token,
    email: state.email,
    logout: state.logout
  }));
  const navigate = useNavigate();
  const { access, plan, canAccess, initialized } = useSubscriptionAccess();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const links = token
    ? [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/signals', label: 'Signals' },
        { to: '/assistant', label: 'Assistant' },
        { to: '/portfolio', label: 'Portfolio' },
        { to: '/forum', label: 'Forum' }
      ]
    : [{ to: '/pricing', label: 'Pricing' }];

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  const openBilling = () => {
    navigate('/billing');
    setMenuOpen(false);
  };

  const openSettings = () => {
    navigate('/billing?tab=settings');
    setMenuOpen(false);
  };

  const accountLabel = email ?? 'Hesabım';

  return (
    <header className="border-b border-slate-800 bg-slate-900/40 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4">
        <div className="group flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/70 via-primary/40 to-accent/40 opacity-80 blur-md transition duration-300 group-hover:opacity-100" />
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-primary/50 bg-slate-900/80 text-lg font-semibold tracking-tight text-primary">
              C
            </span>
          </div>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold uppercase tracking-[0.55em] text-slate-500 transition group-hover:text-slate-300">
              Cortexa
            </p>
            <p className="text-lg font-semibold text-white transition group-hover:text-accent">
              Trade Intelligence
            </p>
          </div>
        </div>

        {token ? (
          <div className="flex flex-1 items-center justify-end gap-4">
            <nav className="hidden items-center gap-6 text-sm md:flex">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `transition-colors ${isActive ? 'text-accent' : 'text-slate-300 hover:text-white'}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <div className="relative">
                <NotificationCenter />
              </div>

              <div className="hidden border-l border-slate-800/50 pl-4 text-xs text-slate-400 lg:flex lg:flex-col">
                <span className="uppercase tracking-wide text-slate-500">Plan</span>
                <span className="font-semibold text-slate-200">{initialized && plan ? plan.toUpperCase() : '—'}</span>
                {!canAccess && access?.status === 'past_due' && (
                  <span className="text-[11px] text-amber-400">Payment past due</span>
                )}
              </div>

              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 transition hover:border-primary hover:text-white"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  {accountLabel}
                  <svg
                    aria-hidden
                    className={`h-3 w-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 12 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-slate-800 bg-slate-900/95 p-2 text-sm text-slate-200 shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={openSettings}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition hover:bg-slate-800/70"
                    >
                      Ayarlar
                      <span className="text-xs text-slate-500">yakında</span>
                    </button>
                    <button
                      type="button"
                      onClick={openBilling}
                      className="mt-1 flex w-full items-center rounded-lg px-3 py-2 transition hover:bg-slate-800/70"
                    >
                      Faturalandırma
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center rounded-lg px-3 py-2 text-rose-300 transition hover:bg-rose-500/10"
                    >
                      Çıkış yap
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <NavLink to="/pricing" className="hover:text-white">
              Pricing
            </NavLink>
            <NavLink to="/login" className="hover:text-white">
              Login
            </NavLink>
            <NavLink
              to="/register"
              className="rounded bg-primary px-3 py-1 font-medium text-white transition hover:bg-primary/80"
            >
              Sign Up
            </NavLink>
          </nav>
        )}
      </div>
    </header>
  );
};

export default NavBar;
