import { CSSProperties, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import C from '@/styles/theme';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const features = [
  { title: 'Signals that move', copy: 'Multi-horizon AI scoring tuned for live crypto conditions.' },
  { title: 'Automation locked in', copy: 'Route setups into disciplined execution with clear risk rails.' },
  { title: 'Assistant on call', copy: 'Summaries, setup context and next-step guidance in seconds.' },
];

const stats = [
  { value: '99.9%', label: 'Signal uptime' },
  { value: '24h', label: 'Desk onboarding' },
  { value: '45+', label: 'Markets covered' },
];

const inputStyle: CSSProperties = { width: '100%', marginTop: 8, borderRadius: 14, border: `1px solid ${C.borderStrong}`, background: 'rgba(255,255,255,0.03)', color: C.text, padding: '14px 16px', outline: 'none', fontSize: 14 };
const labelStyle: CSSProperties = { display: 'block', color: C.textSub, fontSize: 11, fontFamily: C.mono, letterSpacing: '0.14em', textTransform: 'uppercase' };

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, googleLogin, loading, token, error, clearError } = useAuthStore((state) => ({
    login: state.login,
    googleLogin: state.googleLogin,
    loading: state.loading,
    token: state.token,
    error: state.error,
    clearError: state.clearError,
  }));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleGoogleCredential = useCallback(async (resp: { credential: string }) => {
    try {
      await googleLogin(resp.credential);
      navigate('/overview', { replace: true });
    } catch {
      // store handles error state
    }
  }, [googleLogin, navigate]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(googleBtnRef.current, { theme: 'filled_black', size: 'large', width: googleBtnRef.current.offsetWidth || 300, text: 'continue_with', shape: 'pill' });
  }, [handleGoogleCredential]);

  useEffect(() => {
    if (token) navigate('/overview', { replace: true });
  }, [token, navigate]);

  useEffect(() => () => clearError(), [clearError]);

  useEffect(() => {
    if (!forgotOpen) {
      setResetEmail('');
      setResetError(null);
      setResetSuccess(false);
    }
  }, [forgotOpen]);

  const closeResetModal = () => {
    setForgotOpen(false);
    setResetEmail('');
    setResetError(null);
    setResetSuccess(false);
  };

  const mapAuthError = (err: string | null): string | null => {
    if (!err) return null;
    const lower = err.toLowerCase();
    if (lower.includes('no rows in result set') || lower.includes('user not found')) return 'No account was found for that email address.';
    if (lower.includes('invalid credentials') || lower.includes('wrong password')) return 'Incorrect email or password.';
    return "We couldn't sign you in. Please try again.";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await login(email, password);
      navigate('/overview', { replace: true });
    } catch (err) {
      console.error(err);
    }
  };

  const handleForgotSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetError(null);
    const trimmed = resetEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setResetError('Please enter a valid email address.');
      return;
    }
    const subject = encodeURIComponent('Cortexa password reset request');
    const body = encodeURIComponent(`Hello Cortexa team,\n\nPlease help me reset the password for the account associated with ${trimmed}.\n\nThanks.`);
    window.location.href = `mailto:info@cortexaai.net?subject=${subject}&body=${body}`;
    setResetSuccess(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(circle at top left, ${C.greenFaint}, transparent 24%), radial-gradient(circle at bottom right, ${C.purpleMuted}, transparent 26%), ${C.bg}`, color: C.text, fontFamily: C.sans, padding: '32px 20px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'center' }}>
        <section style={{ display: 'grid', gap: 20 }}>
          <div style={{ borderRadius: 32, border: `1px solid ${C.borderStrong}`, background: 'rgba(255,255,255,0.03)', padding: 28, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at top left, ${C.greenMuted}, transparent 30%), radial-gradient(circle at bottom right, ${C.purpleMuted}, transparent 32%)` }} />
            <div style={{ position: 'relative' }}>
              <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>CORTEXA ACCESS</div>
              <h1 style={{ margin: '0 0 14px', fontSize: 52, lineHeight: 1.02, letterSpacing: '-0.05em', fontWeight: 800 }}>Sign in and get back to signal intelligence.</h1>
              <p style={{ margin: '0 0 24px', maxWidth: 540, color: C.textSub, fontSize: 16, lineHeight: 1.7 }}>Live signals, disciplined automation and a market assistant that keeps the context attached to every setup.</p>
              <div style={{ height: 180, borderRadius: 24, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)', position: 'relative', overflow: 'hidden' }}>
                <svg viewBox="0 0 600 220" fill="none" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <path d="M0 150C80 120 120 40 200 70C280 100 320 40 400 80C470 118 520 40 600 70" stroke={C.green} strokeWidth="6" strokeLinecap="round" />
                  <path d="M0 150C80 120 120 40 200 70C280 100 320 40 400 80C470 118 520 40 600 70L600 220L0 220V150Z" fill="rgba(29,158,117,0.12)" />
                </svg>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {features.map((feature) => (
              <div key={feature.title} style={{ borderRadius: 22, border: `1px solid ${C.border}`, background: C.surface, padding: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{feature.title}</div>
                <div style={{ color: C.textSub, fontSize: 13, lineHeight: 1.7 }}>{feature.copy}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
            {stats.map((stat) => (
              <div key={stat.label} style={{ borderRadius: 18, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)', padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{stat.value}</div>
                <div style={{ color: C.textMuted, fontSize: 11, fontFamily: C.mono, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 6 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ maxWidth: 520, width: '100%', margin: '0 auto', borderRadius: 30, border: `1px solid ${C.borderStrong}`, background: 'rgba(9,9,9,0.78)', backdropFilter: 'blur(18px)', padding: 28 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Welcome back</div>
            <div style={{ color: C.textSub, fontSize: 14 }}>Use your workspace credentials to continue.</div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
            {mapAuthError(error) ? <div style={{ borderRadius: 14, border: '1px solid rgba(244,63,94,0.35)', background: 'rgba(244,63,94,0.12)', color: '#fecdd3', padding: '12px 14px', fontSize: 14 }}>{mapAuthError(error)}</div> : null}

            <label style={labelStyle} htmlFor="email">
              Email address
              <input id="email" type="email" value={email} onChange={(event) => { if (error) clearError(); setEmail(event.target.value); }} required autoComplete="email" style={inputStyle} />
            </label>

            <label style={labelStyle} htmlFor="password">
              Password
              <input id="password" type="password" value={password} onChange={(event) => { if (error) clearError(); setPassword(event.target.value); }} required autoComplete="current-password" style={inputStyle} />
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', color: C.textSub, fontSize: 12 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: C.green }} />
                <span>Remember me</span>
              </label>
              <button type="button" onClick={() => setForgotOpen(true)} style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', padding: 0, fontSize: 12 }}>
                Forgot password
              </button>
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', borderRadius: 14, border: 'none', background: C.green, color: C.text, padding: '14px 16px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {GOOGLE_CLIENT_ID ? (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span style={{ color: C.textMuted, fontSize: 12 }}>or</span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>
              <div ref={googleBtnRef} style={{ width: '100%' }} />
            </div>
          ) : null}

          <div style={{ marginTop: 22, textAlign: 'center', fontSize: 13, color: C.textSub }}>
            Need an account? <Link to="/register" style={{ color: C.green }}>Join Cortexa</Link>
          </div>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${C.border}`, display: 'grid', gap: 10, color: C.textMuted, fontSize: 12 }}>
            <div>Enterprise desk support: <a href="mailto:info@cortexaai.net" style={{ color: C.text }}>info@cortexaai.net</a></div>
            <div>© {new Date().getFullYear()} Cortexa Labs</div>
          </div>
        </section>
      </div>

      {forgotOpen ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 30 }}>
          <div style={{ width: '100%', maxWidth: 480, borderRadius: 24, border: `1px solid ${C.borderStrong}`, background: C.bg, padding: 24, position: 'relative' }}>
            <button type="button" onClick={closeResetModal} style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', color: C.textSub, cursor: 'pointer' }}>Close</button>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 10 }}>Reset your password</div>
            <div style={{ color: C.textSub, fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>Enter the email linked to your account. We'll open a draft to <span style={{ color: C.text }}>info@cortexaai.net</span> so the team can help.</div>
            <form onSubmit={handleForgotSubmit} style={{ display: 'grid', gap: 16 }}>
              <label style={labelStyle} htmlFor="reset-email">
                Account email
                <input id="reset-email" type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} required style={inputStyle} />
              </label>
              {resetError ? <div style={{ color: '#fda4af', fontSize: 12 }}>{resetError}</div> : null}
              {resetSuccess ? <div style={{ borderRadius: 14, border: `1px solid ${C.green}`, background: C.greenMuted, color: C.text, padding: '12px 14px', fontSize: 13, lineHeight: 1.7 }}>A mail draft has been opened. If it did not appear, contact <a href="mailto:info@cortexaai.net" style={{ color: C.text, fontWeight: 700 }}>info@cortexaai.net</a>.</div> : null}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="submit" style={{ flex: 1, minWidth: 140, borderRadius: 14, border: 'none', background: C.green, color: C.text, padding: '14px 16px', fontWeight: 700, cursor: 'pointer' }}>Contact support</button>
                <button type="button" onClick={closeResetModal} style={{ flex: 1, minWidth: 140, borderRadius: 14, border: `1px solid ${C.borderStrong}`, background: 'transparent', color: C.text, padding: '14px 16px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LoginPage;
