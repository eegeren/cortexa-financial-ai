import { FormEvent, useEffect, useState } from 'react';
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

  useEffect(() => {
    if (token) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => () => clearError(), [clearError]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInfo('');
    if (password !== confirmation) {
      setInfo('Passwords do not match');
      return;
    }
    if (!kvkkAccepted) {
      setInfo('Lütfen KVKK metnini kabul edin.');
      return;
    }
    try {
      await register({
        email,
        password,
        firstName,
        lastName,
        phone,
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
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card>
        <form onSubmit={handleSubmit} className="flex w-96 flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Create an account</h2>
            <p className="mt-1 text-sm text-slate-400">Register to start receiving signals.</p>
          </div>
          {error && <p className="rounded border border-red-500/50 bg-red-500/10 p-2 text-sm text-red-300">{error}</p>}
          {info && !error && (
            <p className="rounded border border-emerald-500/50 bg-emerald-500/10 p-2 text-sm text-emerald-300">{info}</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-300" htmlFor="firstName">
              First name
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              />
            </label>
            <label className="text-sm text-slate-300" htmlFor="lastName">
              Last name
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              />
            </label>
          </div>
          <label className="text-sm text-slate-300" htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            />
          </label>
          <label className="text-sm text-slate-300" htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            />
          </label>
          <label className="text-sm text-slate-300" htmlFor="confirmation">
            Confirm password
            <input
              id="confirmation"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            />
          </label>
          <label className="text-sm text-slate-300" htmlFor="phone">
            Phone number (optional)
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="5XX XXX XX XX"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex items-start gap-3 text-xs text-slate-300">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border border-slate-600 bg-slate-900 text-primary focus:outline-none"
              checked={kvkkAccepted}
              onChange={(event) => setKvkkAccepted(event.target.checked)}
              required
            />
            <span>
              KVKK ve sorumluluk metnini kabul ediyorum. İşaretleyerek kişisel verilerimin saklanmasını ve hizmet koşullarını kabul etmiş olurum.
            </span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating...' : 'Create account'}
          </button>
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
};

export default RegisterPage;
