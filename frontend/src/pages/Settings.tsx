import { useState } from 'react';

const SECURITY_ACTIONS = [
  { label: 'Update password', href: 'mailto:support@cortexaai.net?subject=Password%20reset%20request' },
  { label: 'Enable two-factor authentication (coming soon)', href: '#' },
  { label: 'Generate new API token (coming soon)', href: '#' }
];

const NOTIFICATION_PREFERENCES = [
  { id: 'signals', label: 'Signal alerts', description: 'Email summaries whenever new high-confidence signals fire.' },
  { id: 'automation', label: 'Automation updates', description: 'Notifications when bots pause, fail, or complete actions.' },
  { id: 'billing', label: 'Billing reminders', description: 'Invoices, renewal reminders, and trial expiry notices.' }
];

const SettingsPage = () => {
  const [preferences, setPreferences] = useState(() => new Set(['signals', 'billing']));

  const togglePreference = (id: string) => {
    setPreferences((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-16">
      <section className="text-center">
        <header className="space-y-4">
          <span className="text-xs uppercase tracking-[0.4em] text-slate-500">Workspace settings</span>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">
            Control security, notifications, and workspace preferences.
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-400">
            Manage how you sign in, who receives alerts, and where important updates are delivered.
          </p>
        </header>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <a
            href="#security"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 font-medium text-black shadow-inner-glow transition hover:bg-slate-200"
          >
            Security controls
          </a>
          <a
            href="#notifications"
            className="inline-flex items-center gap-2 rounded-full border border-outline/50 px-4 py-2 text-slate-200 transition hover:border-outline hover:text-white"
          >
            Notification preferences ↗
          </a>
        </div>
      </section>

      <section id="security" className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
        <h2 className="text-lg font-semibold text-white">Security</h2>
        <p className="mt-2 text-sm text-slate-400">Keep your workspace secure with healthy password hygiene and MFA.</p>
        <ul className="mt-4 space-y-3 text-sm text-accent">
          {SECURITY_ACTIONS.map((action) => (
            <li key={action.label}>
              {action.href === '#' ? (
                <span className="rounded-2xl border border-outline/40 bg-muted/60 px-4 py-2 text-slate-400 opacity-70">
                  {action.label}
                </span>
              ) : (
                <a
                  className="inline-flex items-center gap-2 rounded-2xl border border-outline/40 bg-surface px-4 py-2 transition hover:border-outline hover:text-white"
                  href={action.href}
                  target={action.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel="noreferrer"
                >
                  {action.label} ↗
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">Password resets currently run through support. MFA and token rotation are coming soon.</p>
      </section>

      <section id="notifications" className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
        <h2 className="text-lg font-semibold text-white">Notifications</h2>
        <p className="mt-2 text-sm text-slate-400">Choose which email updates you and your desk receive.</p>
        <div className="mt-4 space-y-3 text-sm text-slate-300">
          {NOTIFICATION_PREFERENCES.map((item) => (
            <label key={item.id} className="flex items-start gap-3 rounded-2xl border border-outline/40 bg-muted/60 p-4">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-outline/50 bg-canvas"
                checked={preferences.has(item.id)}
                onChange={() => togglePreference(item.id)}
              />
              <span>
                <span className="block text-white">{item.label}</span>
                <span className="text-xs text-slate-400">{item.description}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">Notification routing applies at the workspace level. Enterprise desks can configure per-user delivery via support.</p>
      </section>

      <section className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft text-xs text-slate-300">
        <h2 className="text-lg font-semibold text-white">Workspace management</h2>
        <p className="mt-3">Need to add or remove seats, or migrate your workspace? Reach out to <a className="text-primary underline" href="mailto:support@cortexaai.net">support@cortexaai.net</a> and the team will handle it for you.</p>
        <p className="mt-3">Looking to forget your account entirely? Send a request to <a className="text-primary underline" href="mailto:privacy@cortexaai.net">privacy@cortexaai.net</a> and we will action it within 72 hours.</p>
      </section>
    </div>
  );
};

export default SettingsPage;
