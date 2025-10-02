import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

const NavBar = () => {
  const { token, email, logout } = useAuthStore((state) => ({
    token: state.token,
    email: state.email,
    logout: state.logout
  }));
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const links = token
    ? [
        { to: '/dashboard', label: 'Overview' },
        { to: '/signals', label: 'Signals' },
        { to: '/assistant', label: 'Assistant' },
        { to: '/portfolio', label: 'Portfolio' },
        { to: '/forum', label: 'Updates' }
      ]
    : [
        { to: '/pricing', label: 'Pricing' },
        { to: '/login', label: 'Log in' },
        { to: '/register', label: 'Sign up', highlight: true }
      ];

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
    navigate('/settings');
    setMenuOpen(false);
  };

  const accountLabel = email ?? 'Account';

  return (
    <header className="border-b border-outline/40 bg-canvas">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:py-4">
        <button
          type="button"
          onClick={() => navigate(token ? '/dashboard' : '/')}
          className="flex items-center gap-2 text-left text-ink transition hover:text-white"
        >
          <span className="text-xs font-medium uppercase tracking-[0.42em] text-slate-400">Cortexa</span>
          <span className="text-base font-semibold text-white">Trade Intelligence</span>
        </button>

        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `transition-colors ${
                  link.highlight
                    ? 'rounded-full border border-outline/50 px-3 py-1 text-ink hover:border-outline'
                    : isActive
                    ? 'text-white'
                    : 'hover:text-white'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {token ? (
          <div className="flex items-center gap-3">
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-outline/60 bg-surface px-3 py-1.5 text-sm text-ink transition hover:border-outline hover:text-white"
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
                  className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-outline/60 bg-surface p-2 text-sm text-ink shadow-elevation-soft"
                >
                  <button
                    type="button"
                    onClick={openSettings}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition hover:bg-muted/70"
                  >
                    Settings
                    <span className="text-xs text-slate-500">coming soon</span>
                  </button>
                  <button
                    type="button"
                    onClick={openBilling}
                    className="mt-1 flex w-full items-center rounded-lg px-3 py-2 transition hover:bg-muted/70"
                  >
                    Billing
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center rounded-lg px-3 py-2 text-rose-300 transition hover:bg-rose-500/10"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-slate-300 md:gap-4">
            <NavLink to="/pricing" className="hover:text-white">
              Pricing
            </NavLink>
            <NavLink to="/login" className="hover:text-white">
              Log in
            </NavLink>
            <NavLink
              to="/register"
              className="rounded-full border border-outline/60 px-3 py-1 text-ink transition hover:border-outline hover:text-white"
            >
              Sign up
            </NavLink>
          </div>
        )}
      </div>
    </header>
  );
};

export default NavBar;
