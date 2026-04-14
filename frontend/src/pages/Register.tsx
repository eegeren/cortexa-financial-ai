import { CSSProperties, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import C from '@/styles/theme';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: object) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const plans = [
  { key: 'starter', title: 'Starter', price: 'Free', copy: 'Explore the workspace and limited signal flow.', perks: ['7-day trial', 'Core signal access', 'No card required'], accent: C.textSub, bg: C.surface },
  { key: 'premium', title: 'Premium', price: '$29', copy: 'Full signal coverage, AI tools and automation workflows.', perks: ['180+ pairs', 'AI advisor', 'Backtest + automation'], accent: C.green, bg: C.greenMuted },
];

const cardPoints = [
  { title: 'Signals with provenance', copy: 'Multi-timeframe models with context and clearer audit trails.' },
  { title: 'Secure by design', copy: 'Privacy controls, encrypted handling and compliance-minded onboarding.' },
  { title: 'Concierge-ready', copy: 'Built for solo traders and desks that need a smoother activation path.' },
  { title: 'Enterprise capable', copy: 'Scale into seat controls, integrations and premium support when needed.' },
];

const inputStyle: CSSProperties = { width: '100%', marginTop: 8, borderRadius: 14, border: `1px solid ${C.borderStrong}`, background: 'rgba(255,255,255,0.03)', color: C.text, padding: '14px 16px', outline: 'none', fontSize: 14 };
const labelStyle: CSSProperties = { display: 'block', color: C.textSub, fontSize: 11, fontFamily: C.mono, letterSpacing: '0.14em', textTransform: 'uppercase' };

const RegisterPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { register, googleLogin, loading, token, error, clearError } = useAuthStore((state) => ({
    register: state.register,
    googleLogin: state.googleLogin,
    loading: state.loading,
    token: state.token,
    error: state.error,
    clearError: state.clearError,
  }));
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleGoogleCredential = useCallback(async (resp: { credential: string }) => {
    try {
      await googleLogin(resp.credential);
      navigate('/overview', { replace: true });
    } catch {
      // store handles error
    }
  }, [googleLogin, navigate]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(googleBtnRef.current, { theme: 'filled_black', size: 'large', width: googleBtnRef.current.offsetWidth || 300, text: 'signup_with', shape: 'pill' });
  }, [handleGoogleCredential]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [info, setInfo] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const selectedPlan = (searchParams.get('plan') || 'starter').toLowerCase() === 'premium' ? 'premium' : 'starter';

  useEffect(() => {
    if (token) navigate('/overview', { replace: true });
  }, [token, navigate]);

  useEffect(() => () => clearError(), [clearError]);

  const passwordScore = useMemo(() => {
    let score = 0;
    if (password.length >= 12) score += 2;
    else if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const passwordStrength = useMemo(() => {
    if (!password) return { label: 'Enter a password', tone: C.textMuted };
    if (passwordScore >= 5) return { label: 'Strong password', tone: C.green };
    if (passwordScore >= 3) return { label: 'Good password', tone: '#fbbf24' };
    return { label: 'Weak password', tone: '#fb7185' };
  }, [password, passwordScore]);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!firstName.trim()) errors.firstName = 'First name is required.';
    if (!lastName.trim()) errors.lastName = 'Last name is required.';
    if (!email.trim()) errors.email = 'Email is required.';
    if (password.length < 8) errors.password = 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) errors.password = 'Use upper, lower case letters and a number.';
    if (password !== confirmation) errors.confirmation = 'Passwords do not match.';
    if (!termsAccepted) errors.kvkk = 'Please accept the terms and privacy policy.';
    if (phone && !/^\+?[0-9 ()-]{8,}$/.test(phone)) errors.phone = 'Please provide a valid phone number.';
    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInfo('');
    const validation = validate();
    setFieldErrors(validation);
    if (Object.keys(validation).length > 0) return;
    try {
      await register({ email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), kvkkAccepted: termsAccepted });
      setInfo('Registration successful, please log in.');
      setEmail('');
      setPassword('');
      setConfirmation('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setTermsAccepted(false);
      setMarketingAccepted(false);
      setFieldErrors({});
    } catch (err) {
      console.error(err);
    }
  };

  const clearFieldError = (name: string) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(circle at top left, ${C.greenFaint}, transparent 24%), radial-gradient(circle at bottom right, ${C.purpleMuted}, transparent 28%), ${C.bg}`, color: C.text, fontFamily: C.sans, padding: '32px 20px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
        <section style={{ display: 'grid', gap: 18 }}>
          <div style={{ borderRadius: 32, border: `1px solid ${C.borderStrong}`, background: 'rgba(255,255,255,0.03)', padding: 28, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at top left, ${C.greenMuted}, transparent 30%), radial-gradient(circle at bottom right, ${C.purpleMuted}, transparent 32%)` }} />
            <div style={{ position: 'relative' }}>
              <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>CORTEXA ONBOARDING</div>
              <h1 style={{ margin: '0 0 14px', fontSize: 50, lineHeight: 1.02, letterSpacing: '-0.05em', fontWeight: 800 }}>Build your edge with institutional-grade signal tooling.</h1>
              <p style={{ margin: 0, maxWidth: 560, color: C.textSub, fontSize: 16, lineHeight: 1.7 }}>Create your account to unlock live market reads, automation-ready workflows and a cleaner decision system from day one.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {cardPoints.map((item) => (
              <div key={item.title} style={{ borderRadius: 22, border: `1px solid ${C.border}`, background: C.surface, padding: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{item.title}</div>
                <div style={{ color: C.textSub, fontSize: 13, lineHeight: 1.7 }}>{item.copy}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: C.textSub, fontSize: 12 }}>
            {['99.9% uptime', 'AES-256 encryption', 'SOC2-ready controls'].map((item) => (
              <div key={item} style={{ borderRadius: 999, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)', padding: '10px 14px' }}>{item}</div>
            ))}
          </div>
        </section>

        <section style={{ width: '100%', maxWidth: 560, margin: '0 auto', borderRadius: 30, border: `1px solid ${C.borderStrong}`, background: 'rgba(9,9,9,0.78)', backdropFilter: 'blur(18px)', padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>Create your account</div>
              <div style={{ color: C.textSub, fontSize: 14 }}>We use your details to personalize analytics and onboarding.</div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Choose your plan</div>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {plans.map((plan) => {
                  const active = selectedPlan === plan.key;
                  return (
                    <button key={plan.key} type="button" onClick={() => setSearchParams(plan.key === 'premium' ? { plan: 'premium' } : {})} style={{ textAlign: 'left', borderRadius: 20, border: active ? `2px solid ${plan.key === 'premium' ? C.green : C.borderStrong}` : `1px solid ${C.border}`, background: active ? plan.bg : C.surface, padding: 18, cursor: 'pointer', color: C.text }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{plan.title}</div>
                        <div style={{ color: plan.accent, fontFamily: C.mono, fontSize: 12 }}>{plan.price}</div>
                      </div>
                      <div style={{ color: C.textSub, fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>{plan.copy}</div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {plan.perks.map((perk) => <div key={perk} style={{ color: C.textSub, fontSize: 12 }}>+ {perk}</div>)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? <div style={{ borderRadius: 14, border: '1px solid rgba(244,63,94,0.35)', background: 'rgba(244,63,94,0.12)', color: '#fecdd3', padding: '12px 14px', fontSize: 14 }}>{error}</div> : null}
            {info && !error ? <div style={{ borderRadius: 14, border: `1px solid ${C.green}`, background: C.greenMuted, color: C.text, padding: '12px 14px', fontSize: 14 }}>{info}</div> : null}

            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={labelStyle} htmlFor="firstName">
                First name
                <input id="firstName" type="text" value={firstName} onChange={(event) => { setFirstName(event.target.value); clearFieldError('firstName'); }} required style={inputStyle} />
                {fieldErrors.firstName ? <span style={{ color: '#fda4af', fontSize: 11, marginTop: 6, display: 'block' }}>{fieldErrors.firstName}</span> : null}
              </label>
              <label style={labelStyle} htmlFor="lastName">
                Last name
                <input id="lastName" type="text" value={lastName} onChange={(event) => { setLastName(event.target.value); clearFieldError('lastName'); }} required style={inputStyle} />
                {fieldErrors.lastName ? <span style={{ color: '#fda4af', fontSize: 11, marginTop: 6, display: 'block' }}>{fieldErrors.lastName}</span> : null}
              </label>
            </div>

            <label style={labelStyle} htmlFor="email">
              Work email
              <input id="email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); clearFieldError('email'); }} required style={inputStyle} />
              {fieldErrors.email ? <span style={{ color: '#fda4af', fontSize: 11, marginTop: 6, display: 'block' }}>{fieldErrors.email}</span> : null}
            </label>

            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={labelStyle} htmlFor="password">
                Password
                <input id="password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); clearFieldError('password'); }} required style={inputStyle} />
                <span style={{ color: passwordStrength.tone, fontSize: 11, marginTop: 6, display: 'block' }}>{passwordStrength.label}</span>
                {fieldErrors.password ? <span style={{ color: '#fda4af', fontSize: 11, marginTop: 6, display: 'block' }}>{fieldErrors.password}</span> : null}
              </label>
              <label style={labelStyle} htmlFor="confirmation">
                Confirm password
                <input id="confirmation" type="password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); clearFieldError('confirmation'); }} required style={inputStyle} />
                {fieldErrors.confirmation ? <span style={{ color: '#fda4af', fontSize: 11, marginTop: 6, display: 'block' }}>{fieldErrors.confirmation}</span> : null}
              </label>
            </div>

            <label style={labelStyle} htmlFor="phone">
              Mobile (optional)
              <input id="phone" type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); clearFieldError('phone'); }} placeholder="+90 5XX XXX XX XX" style={inputStyle} />
              {fieldErrors.phone ? <span style={{ color: '#fda4af', fontSize: 11, marginTop: 6, display: 'block' }}>{fieldErrors.phone}</span> : null}
            </label>

            <div style={{ borderRadius: 18, border: `1px solid ${C.border}`, background: C.surface, padding: 16, display: 'grid', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: C.textSub, lineHeight: 1.7 }}>
                <input type="checkbox" checked={termsAccepted} onChange={(event) => { setTermsAccepted(event.target.checked); clearFieldError('kvkk'); }} required style={{ marginTop: 2, accentColor: C.green }} />
                <span>I agree to the <Link to="/legal/terms" style={{ color: C.green }}>Terms of Service</Link> and <Link to="/legal/privacy" style={{ color: C.green }}>Privacy Policy</Link>.</span>
              </label>
              {fieldErrors.kvkk ? <span style={{ color: '#fda4af', fontSize: 11 }}>{fieldErrors.kvkk}</span> : null}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: C.textSub, lineHeight: 1.7 }}>
                <input type="checkbox" checked={marketingAccepted} onChange={(event) => setMarketingAccepted(event.target.checked)} style={{ marginTop: 2, accentColor: C.green }} />
                <span>Send me product updates and trading research.</span>
              </label>
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', borderRadius: 14, border: 'none', background: C.green, color: C.text, padding: '15px 16px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating account...' : selectedPlan === 'premium' ? 'Create premium account' : 'Create account'}
            </button>

            {GOOGLE_CLIENT_ID ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                  <span style={{ color: C.textMuted, fontSize: 12 }}>or sign up with</span>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                </div>
                <div ref={googleBtnRef} style={{ width: '100%' }} />
              </div>
            ) : null}

            <div style={{ color: C.textSub, fontSize: 13 }}>Already have an account? <Link to="/login" style={{ color: C.green }}>Log in</Link></div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default RegisterPage;
