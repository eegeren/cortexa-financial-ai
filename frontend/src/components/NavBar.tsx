import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import BrandWordmark from '@/components/BrandWordmark';
import usePremiumStatus from '@/hooks/usePremiumStatus';

const Icon = {
  assistant: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H9l-4 3v-3H4a2 2 0 01-2-2V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M2 14l4-5 3 3 4-6 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="9" r="1.2" fill="currentColor" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="13" cy="6" r="1.2" fill="currentColor" />
      <circle cx="17" cy="10" r="1.2" fill="currentColor" />
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
  news: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M4 4.5h9a2.5 2.5 0 012.5 2.5v8.5H6A2.5 2.5 0 013.5 13V5A.5.5 0 014 4.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 8H12.5M6.5 11H12.5M6.5 14H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
  pulse: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M2 10h3l2-4 3 8 2-4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bot: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <rect x="4" y="5" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2.5V5M7.5 9.5h.01M12.5 9.5h.01M7 12.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
};

type IconKey = keyof typeof Icon;

const NavBar = () => {
  const { token, email, firstName, lastName, logout } = useAuthStore((state) => ({
    token: state.token,
    email: state.email,
    firstName: state.firstName,
    lastName: state.lastName,
    logout: state.logout,
  }));
  const { isPremium } = usePremiumStatus();
  const isPublicNav = !token;
  const navigate = useNavigate();
  const location = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  const authedLinks: { to: string; label: string; icon: IconKey; badge?: string }[] = [
    { to: '/overview', label: 'Overview', icon: 'overview' },
    { to: '/analytics', label: 'Intelligence', icon: 'analytics' },
    { to: '/assistant', label: 'Assistant', icon: 'assistant' },
    { to: '/signals', label: 'Signals', icon: 'signals' },
    { to: '/stats', label: 'Performans', icon: 'analytics', badge: 'PREMIUM' },
    { to: '/bot/settings', label: 'Bot', icon: 'bot', badge: 'PREMIUM' },
    { to: '/portfolio', label: 'Portfolio', icon: 'portfolio' },
    { to: '/forum', label: 'Forum', icon: 'updates' },
    { to: '/news', label: 'News', icon: 'news' },
    { to: '/pricing', label: 'Pricing', icon: 'pricing' },
  ];

  const publicLinks: { to: string; label: string; icon: IconKey; highlight?: boolean; badge?: string }[] = [
    { to: '/pulse', label: 'Pulse', icon: 'pulse' },
    { to: '/pricing', label: 'Pricing', icon: 'pricing' },
    { to: '/login', label: 'Log in', icon: 'login' },
    { to: '/register', label: 'Sign up', icon: 'signup', highlight: true },
  ];

  const activeLinks = token ? authedLinks : publicLinks;

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || email || 'Account';

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 text-[14px] transition-colors ${
      isActive
        ? 'bg-[rgba(29,158,117,0.1)] font-medium text-[#1D9E75]'
        : 'text-[rgba(255,255,255,0.45)] hover:bg-[rgba(29,158,117,0.1)] hover:text-[#1D9E75]'
    }`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-2xl border px-3.5 py-3 text-sm transition ${
      isActive
        ? 'border-[rgba(29,158,117,0.3)] bg-[rgba(29,158,117,0.1)] text-[#1D9E75]'
        : 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.45)] hover:bg-[rgba(29,158,117,0.1)] hover:text-[#1D9E75]'
    }`;

  return (
    <>
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col overflow-y-auto border-r border-[rgba(255,255,255,0.07)] bg-[#0d0d0d] px-3 pb-6 pt-7 lg:flex">
        <button
          type="button"
          onClick={() => navigate(token ? '/overview' : '/')}
          className="self-start rounded-xl px-2 py-1.5 text-left transition hover:bg-white/[0.04]"
        >
          <BrandWordmark className="text-sm font-black tracking-[0.2em] text-white" />
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
              <span className="flex items-center gap-2">
                <span>{link.label}</span>
                {link.badge && <span className="rounded-[4px] bg-[rgba(29,158,117,0.15)] px-1.5 py-0.5 font-mono text-[10px] text-[#1D9E75]">{link.badge}</span>}
              </span>
            </NavLink>
          ))}
        </nav>

        <div ref={accountRef} className="relative mt-auto border-t border-[rgba(255,255,255,0.07)] bg-transparent pt-4">
          {token ? (
            <>
              <button
                type="button"
                onClick={() => setAccountOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-[rgba(255,255,255,0.07)] bg-transparent px-3 py-2 text-sm text-[rgba(255,255,255,0.45)] transition hover:bg-[rgba(255,255,255,0.03)] hover:text-white"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-[10px] font-semibold text-white uppercase shadow-inner shadow-black/30">
                    {displayName[0] ?? 'A'}
                  </div>
                  <div className="min-w-0 text-left">
                    <span className="block truncate text-[13px] font-medium leading-5 text-white">{displayName}</span>
                    {email && <span className="block truncate text-[11px] leading-4 text-white/30">{email}</span>}
                    {isPremium && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-[4px] bg-[rgba(29,158,117,0.15)] px-1.5 py-0.5 font-mono text-[10px] text-[#1D9E75]">
                        <span aria-hidden className="text-[8px]">★</span>
                        PREMIUM
                      </span>
                    )}
                  </div>
                </div>
                <svg aria-hidden viewBox="0 0 12 8" className={`h-3 w-3 shrink-0 text-[rgba(255,255,255,0.35)] transition-transform ${accountOpen ? 'rotate-180' : ''}`} fill="none">
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {accountOpen && (
                <div role="menu" className="absolute bottom-14 left-0 right-0 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0a0a0a] p-1.5 text-sm text-white/80 shadow-elevation-soft">
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/settings');
                      setAccountOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-white/[0.06]"
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/billing');
                      setAccountOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-white/[0.06]"
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
            <div className="space-y-1.5 rounded-xl border border-[rgba(255,255,255,0.07)] bg-transparent p-3 text-sm text-[rgba(255,255,255,0.45)]">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.3)]">Get started</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.07)] px-3 py-2 text-left text-sm transition hover:bg-[rgba(29,158,117,0.1)] hover:text-[#1D9E75]"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="w-full rounded-lg border border-[rgba(29,158,117,0.3)] bg-[rgba(29,158,117,0.1)] px-3 py-2 text-left text-sm text-[#1D9E75] transition hover:bg-[rgba(29,158,117,0.15)]"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </aside>

      <nav className="sticky top-0 z-30 border-b border-[rgba(255,255,255,0.07)] bg-[rgba(10,10,10,0.92)] px-3 py-3 backdrop-blur-[12px] sm:px-4 lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(token ? '/overview' : '/')}
            className="text-left transition hover:text-white"
          >
            <BrandWordmark className="text-sm font-black tracking-[0.2em] text-white" />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm text-white/80 transition hover:border-[rgba(255,255,255,0.15)]"
            aria-haspopup="dialog"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {token && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(29,158,117,0.15)] text-[9px] font-bold text-[#1D9E75] uppercase">
                {displayName[0] ?? 'A'}
              </div>
            )}
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(10,10,10,0.92)] backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          />
          <div className="absolute inset-x-3 top-16 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-[1.75rem] border border-[rgba(255,255,255,0.07)] bg-[#0a0a0a] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.07)] pb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[rgba(255,255,255,0.3)]">Navigation</p>
                {token && (
                  <>
                    <p className="mt-1 text-sm font-medium text-white/80">{displayName}</p>
                    {email && <p className="mt-0.5 text-xs text-white/50">{email}</p>}
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-full border border-[rgba(255,255,255,0.07)] px-3 py-1 text-xs text-[rgba(255,255,255,0.5)]"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {activeLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={mobileLinkClass}
                >
                  {Icon[link.icon]}
                  <span className="flex items-center gap-2">
                    <span>{link.label}</span>
                    {link.badge && <span className="rounded-[4px] bg-[rgba(29,158,117,0.15)] px-1.5 py-0.5 font-mono text-[10px] text-[#1D9E75]">{link.badge}</span>}
                  </span>
                </NavLink>
              ))}
            </div>

            {token ? (
              <div className="mt-4 grid gap-2 border-t border-[rgba(255,255,255,0.07)] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/settings');
                    setMobileMenuOpen(false);
                  }}
                  className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3.5 py-3 text-left text-sm text-white/80"
                >
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/billing');
                    setMobileMenuOpen(false);
                  }}
                  className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3.5 py-3 text-left text-sm text-white/80"
                >
                  Billing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3.5 py-3 text-left text-sm text-rose-200"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="mt-4 grid gap-2 border-t border-[rgba(255,255,255,0.07)] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/login');
                    setMobileMenuOpen(false);
                  }}
                  className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3.5 py-3 text-left text-sm text-white/80"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/register');
                    setMobileMenuOpen(false);
                  }}
                  className="rounded-2xl border border-[rgba(29,158,117,0.3)] bg-[rgba(29,158,117,0.1)] px-3.5 py-3 text-left text-sm text-[#1D9E75]"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default NavBar;
