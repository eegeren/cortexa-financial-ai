import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

const Icon = {
  assistant: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H9l-4 3v-3H4a2 2 0 01-2-2V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  signals: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M1 13l4-6 4 3 4-6 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  overview: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  portfolio: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <rect x="2" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 6V5a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  updates: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M10 2a6 6 0 00-6 6c0 3-1.5 5-2 6h16c-.5-1-2-3-2-6a6 6 0 00-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 18a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  pricing: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M3 10l7-7 7 7M5 8v8a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  login: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M9 3H4a1 1 0 00-1 1v12a1 1 0 001 1h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 7l4 3-4 3M17 10H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  signup: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M4 16a5 5 0 018.584-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 11v4M13 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  logo: (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

type IconKey = keyof typeof Icon;

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

  const authedLinks: { to: string; label: string; icon: IconKey }[] = [
    { to: '/assistant', label: 'Assistant', icon: 'assistant' },
    { to: '/signals', label: 'Signals', icon: 'signals' },
    { to: '/dashboard', label: 'Overview', icon: 'overview' },
    { to: '/portfolio', label: 'Portfolio', icon: 'portfolio' },
    { to: '/forum', label: 'Forum', icon: 'updates' },
  ];

  const publicLinks: { to: string; label: string; icon: IconKey; highlight?: boolean }[] = [
    { to: '/pricing', label: 'Pricing', icon: 'pricing' },
    { to: '/login', label: 'Log in', icon: 'login' },
    { to: '/register', label: 'Sign up', icon: 'signup', highlight: true },
  ];

  const activeLinks = token ? authedLinks : publicLinks;

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

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-sm transition-all ${
      isActive
        ? 'border-primary/50 bg-primary/15 font-medium text-slate-100'
        : 'text-slate-300 hover:border-slate-600/50 hover:bg-slate-900/40 hover:text-white'
    }`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
      isActive
        ? 'border-primary/60 bg-primary/15 text-slate-100'
        : 'border-slate-600/40 bg-slate-900/35 text-slate-300 hover:text-white'
    }`;

  return (
    <>
      <aside className="hidden w-60 flex-col border-r border-slate-700/40 bg-slate-950/35 px-3 pb-6 pt-7 backdrop-blur lg:flex">
        <button
          type="button"
          onClick={() => navigate(token ? '/assistant' : '/')}
          className="flex items-center gap-2.5 self-start rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-800/35"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            {Icon.logo}
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.45em] text-slate-500 leading-none">Cortexa</div>
            <div className="text-sm font-semibold text-slate-100 leading-tight">Trade</div>
          </div>
        </button>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {activeLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={desktopLinkClass}
              onClick={() => setAccountOpen(false)}
            >
              {Icon[link.icon]}
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div ref={accountRef} className="relative mt-auto pt-4">
          {token ? (
            <>
              <button
                type="button"
                onClick={() => setAccountOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-700/40 bg-slate-900/45 px-3 py-2.5 text-sm text-slate-300 transition hover:border-slate-500/70 hover:text-white"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary uppercase">
                    {(email ?? 'A')[0]}
                  </div>
                  <span className="truncate text-xs">{email ?? 'Account'}</span>
                </div>
                <svg aria-hidden viewBox="0 0 12 8" className={`h-3 w-3 shrink-0 transition-transform ${accountOpen ? 'rotate-180' : ''}`} fill="none">
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {accountOpen && (
                <div role="menu" className="absolute bottom-14 left-0 right-0 rounded-xl border border-slate-700/40 bg-slate-950/95 p-1.5 text-sm text-slate-200 shadow-elevation-soft">
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/settings');
                      setAccountOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-slate-800/70"
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/billing');
                      setAccountOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-slate-800/70"
                  >
                    Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-rose-300 transition hover:bg-rose-500/10"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-1.5 rounded-xl border border-slate-700/40 bg-slate-900/45 p-3 text-sm text-slate-300">
              <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Get started</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full rounded-lg border border-slate-700/40 px-3 py-2 text-left text-sm transition hover:border-slate-500 hover:text-white"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="w-full rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-left text-sm text-primary transition hover:bg-primary/15 hover:text-white"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </aside>

      <nav className="sticky top-0 z-20 border-b border-slate-700/40 bg-slate-950/85 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(token ? '/assistant' : '/')}
            className="flex items-center gap-2 text-left transition hover:text-white"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
              {Icon.logo}
            </div>
            <span className="text-sm font-semibold text-slate-100">Cortexa</span>
          </button>

          {token && (
            <div ref={mobileAccountRef} className="relative">
              <button
                type="button"
                onClick={() => setMobileAccountOpen((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-full border border-slate-600/60 bg-slate-900/50 px-2.5 py-1 text-slate-300 transition hover:border-slate-400 hover:text-white"
                aria-haspopup="menu"
                aria-expanded={mobileAccountOpen}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary uppercase">
                  {(email ?? 'A')[0]}
                </div>
                <svg aria-hidden viewBox="0 0 12 8" className={`h-2.5 w-2.5 transition-transform ${mobileAccountOpen ? 'rotate-180' : ''}`} fill="none">
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {mobileAccountOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-700/40 bg-slate-950/95 p-1.5 text-sm text-slate-200 shadow-elevation-soft">
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/settings');
                      setMobileAccountOpen(false);
                    }}
                    className="flex w-full items-center rounded-lg px-3 py-2 transition hover:bg-slate-800/70"
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/billing');
                      setMobileAccountOpen(false);
                    }}
                    className="flex w-full items-center rounded-lg px-3 py-2 transition hover:bg-slate-800/70"
                  >
                    Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileAccountOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-rose-300 transition hover:bg-rose-500/10"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 overflow-x-auto">
          <div className="flex min-w-max items-center gap-2 pb-1">
            {activeLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileAccountOpen(false)}
                className={mobileLinkClass}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
};

export default NavBar;
