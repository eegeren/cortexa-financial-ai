import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import NotificationCenter from '@/components/NotificationCenter';
import useSubscriptionAccess from '@/hooks/useSubscriptionAccess';

const NavBar = () => {
  const { token, email, logout } = useAuthStore((state) => ({
    token: state.token,
    email: state.email,
    logout: state.logout
  }));
  const navigate = useNavigate();
  const { access, plan, canAccess, initialized } = useSubscriptionAccess();
  const links = token
    ? [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/signals', label: 'Signals' },
        { to: '/assistant', label: 'Assistant' },
        { to: '/portfolio', label: 'Portfolio' },
        { to: '/forum', label: 'Forum' },
        { to: '/pricing', label: 'Pricing' },
        { to: '/billing', label: 'Billing' }
      ]
    : [{ to: '/pricing', label: 'Pricing' }];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
          <nav className="flex items-center gap-6 text-sm">
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
            <div className="hidden border-l border-slate-800/50 pl-4 text-xs text-slate-400 md:flex md:flex-col">
              <span className="uppercase tracking-wide text-slate-500">Plan</span>
              <span className="font-semibold text-slate-200">{initialized ? plan.toUpperCase() : '—'}</span>
              {!canAccess && access?.status === 'past_due' && (
                <span className="text-[11px] text-amber-400">Payment past due</span>
              )}
            </div>
            <NotificationCenter />
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{email}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded border border-slate-700 px-2 py-1 text-slate-300 transition hover:border-primary hover:text-white"
              >
                Logout
              </button>
            </div>
          </nav>
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
