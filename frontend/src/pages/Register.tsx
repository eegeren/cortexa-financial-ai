import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import Card from '@/components/Card';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, loading, token, error, clearError } = useAuthStore((state) => ({
    register: state.register,
    loading: state.loading,
    token: state.token,
    error: state.error,
    clearError: state.clearError
  }));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [info, setInfo] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (token) {
      navigate('/dashboard', { replace: true });
    }
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
    if (!password) return { label: 'Enter a password', tone: 'muted' };
    if (passwordScore >= 5) return { label: 'Strong password', tone: 'success' };
    if (passwordScore >= 3) return { label: 'Good password', tone: 'warning' };
    return { label: 'Weak password', tone: 'error' };
  }, [password, passwordScore]);

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!firstName.trim()) errors.firstName = 'First name is required.';
    if (!lastName.trim()) errors.lastName = 'Last name is required.';
    if (!email.trim()) errors.email = 'Email is required.';
    if (password.length < 8) errors.password = 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      errors.password = 'Use upper, lower case letters and a number.';
    }
    if (password !== confirmation) errors.confirmation = 'Passwords do not match.';
    if (!kvkkAccepted) errors.kvkk = 'Please consent to privacy terms.';

    if (phone && !/^\+?[0-9 ()-]{8,}$/.test(phone)) {
      errors.phone = 'Please provide a valid phone number.';
    }

    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInfo('');
    const validation = validate();
    setFieldErrors(validation);
    if (Object.keys(validation).length > 0) {
      return;
    }

    try {
      await register({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        kvkkAccepted
      });
      setInfo('Registration successful, please log in.');
      setEmail('');
      setPassword('');
      setConfirmation('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setKvkkAccepted(false);
      setFieldErrors({});
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-[-10%] h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-[-25%] right-[-15%] h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.6),_transparent_55%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-16 lg:flex-row lg:items-center lg:gap-16">
        <section className="w-full space-y-8 text-slate-200 lg:w-1/2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-[11px] uppercase tracking-[0.45em] text-primary">
            Join Cortexa
          </div>
          <header className="space-y-4">
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">
              Build your edge with institutional grade intelligence.
            </h1>
            <p className="max-w-xl text-sm text-slate-300">
              Cortexa surfaces AI-calibrated trade ideas, live risk analytics, and automated execution in a single workspace. Create an account to unlock tailored strategies and concierge onboarding.
            </p>
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border border-slate-800/60 bg-slate-900/60 p-5">
              <h3 className="text-sm font-semibold text-white">Signals with provenance</h3>
              <p className="mt-2 text-xs text-slate-400">Multi-timeframe models, audited backtests, and live hit-rate tracking keep you ahead of market drift.</p>
            </Card>
            <Card className="border border-slate-800/60 bg-slate-900/60 p-5">
              <h3 className="text-sm font-semibold text-white">Secure compliance</h3>
              <p className="mt-2 text-xs text-slate-400">KVKK-ready data policies, GDPR-aligned consent flows, and SOC2-aligned infrastructure.</p>
            </Card>
            <Card className="border border-slate-800/60 bg-slate-900/60 p-5">
              <h3 className="text-sm font-semibold text-white">Dedicated onboarding</h3>
              <p className="mt-2 text-xs text-slate-400">Portfolio walkthroughs, playbook templates, and direct analyst support in Turkish & English.</p>
            </Card>
            <Card className="border border-slate-800/60 bg-slate-900/60 p-5">
              <h3 className="text-sm font-semibold text-white">Enterprise ready</h3>
              <p className="mt-2 text-xs text-slate-400">Role-based access, audit trails, and custom SLAs for desks running multi-seat operations.</p>
            </Card>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-emerald-200">98% uptime</span>
            <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-blue-200">AES-256 encryption</span>
            <span className="rounded-full border border-slate-700 px-4 py-2">ISO-ready controls</span>
          </div>
        </section>

        <section className="w-full lg:w-1/2">
          <Card className="border border-slate-800/70 bg-slate-950/90 p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold text-white">Create your account</h2>
                <p className="text-xs text-slate-400">We use your details to personalise analytics and provide regulatory reporting.</p>
              </div>

              {error && (
                <p className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
              )}
              {info && !error && (
                <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{info}</p>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="firstName">
                  First name
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  if (fieldErrors.firstName) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.firstName;
                      return next;
                    });
                  }
                }}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                  />
                  {fieldErrors.firstName && <span className="text-[11px] text-red-400">{fieldErrors.firstName}</span>}
                </label>
                <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="lastName">
                  Last name
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                onChange={(event) => {
                  setLastName(event.target.value);
                  if (fieldErrors.lastName) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.lastName;
                      return next;
                    });
                  }
                }}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                  />
                  {fieldErrors.lastName && <span className="text-[11px] text-red-400">{fieldErrors.lastName}</span>}
                </label>
              </div>

              <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="email">
                Work email
                <input
                  id="email"
                  type="email"
                  value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.email;
                    return next;
                  });
                }
              }}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                />
                {fieldErrors.email && <span className="text-[11px] text-red-400">{fieldErrors.email}</span>}
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="password">
                  Password
                  <input
                    id="password"
                    type="password"
                    value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.password;
                        return next;
                      });
                    }
                  }}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                  />
                  <span
                    className={`mt-1 text-[11px] ${
                      passwordStrength.tone === 'success'
                        ? 'text-emerald-300'
                        : passwordStrength.tone === 'warning'
                        ? 'text-amber-300'
                        : passwordStrength.tone === 'error'
                        ? 'text-red-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {passwordStrength.label}
                  </span>
                  {fieldErrors.password && <span className="text-[11px] text-red-400">{fieldErrors.password}</span>}
                </label>
                <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="confirmation">
                  Confirm password
                  <input
                    id="confirmation"
                    type="password"
                    value={confirmation}
                  onChange={(event) => {
                    setConfirmation(event.target.value);
                    if (fieldErrors.confirmation) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.confirmation;
                        return next;
                      });
                    }
                  }}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                  />
                  {fieldErrors.confirmation && <span className="text-[11px] text-red-400">{fieldErrors.confirmation}</span>}
                </label>
              </div>

              <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="phone">
                Mobile (for 2FA, optional)
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  if (fieldErrors.phone) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.phone;
                      return next;
                    });
                  }
                }}
                  placeholder="+90 5XX XXX XX XX"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                />
                {fieldErrors.phone && <span className="text-[11px] text-red-400">{fieldErrors.phone}</span>}
              </label>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <label className="flex items-start gap-3 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border border-slate-600 bg-slate-900 text-primary focus:outline-none"
                    checked={kvkkAccepted}
                    onChange={(event) => {
                      setKvkkAccepted(event.target.checked);
                      if (fieldErrors.kvkk) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.kvkk;
                          return next;
                        });
                      }
                    }}
                    required
                  />
                  <span>
                    I agree to Cortexa’s <span className="text-primary">Privacy Notice</span> and understand that my personal data will be processed in line with KVKK and GDPR requirements.
                  </span>
                </label>
                {fieldErrors.kvkk && <span className="mt-2 block text-[11px] text-red-400">{fieldErrors.kvkk}</span>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>

              <p className="text-xs text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="text-accent hover:underline">
                  Log in
                </Link>
              </p>
            </form>

            <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-xs text-slate-400">
              <h4 className="text-sm font-semibold text-white">What happens next?</h4>
              <ul className="mt-3 space-y-2">
                <li>• We’ll verify your email and provision premium market data.</li>
                <li>• A member of the desk will schedule a strategy walkthrough.</li>
                <li>• You can invite teammates once onboarding is complete.</li>
              </ul>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default RegisterPage;
