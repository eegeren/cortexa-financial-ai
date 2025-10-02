import { FormEvent, useEffect, useMemo, useState } from 'react';
import Paywall from '@/components/Paywall';
import Skeleton from '@/components/Skeleton';
import useSubscriptionAccess from '@/hooks/useSubscriptionAccess';
import { useSubscriptionStore } from '@/store/subscription';
import { updateBillingProfile, BillingProfile } from '@/services/api';

const emptyProfile: BillingProfile = {
  country: '',
  vat_id: '',
  company_name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  postal_code: '',
};

const BillingPage = () => {
  const { loading, canAccess, subscription, access, initialized } = useSubscriptionAccess();
  const { hydrate, loadInvoices, invoices, loadProfile, profile, getPortalUrl } = useSubscriptionStore((state) => ({
    hydrate: state.refresh,
    loadInvoices: state.loadInvoices,
    invoices: state.invoices,
    loadProfile: state.loadProfile,
    profile: state.profile,
    getPortalUrl: state.getPortalUrl,
  }));

  const [profileDraft, setProfileDraft] = useState<BillingProfile>(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!subscription) {
      void hydrate();
    }
    void loadInvoices();
    void loadProfile().catch(() => undefined);
  }, [hydrate, loadInvoices, loadProfile, subscription]);

  useEffect(() => {
    if (profile) {
      setProfileDraft({ ...emptyProfile, ...profile });
    }
  }, [profile]);

  const statusCopy = useMemo(() => {
    if (!access) {
      return 'No active subscription';
    }
    if (access.status === 'trialing') {
      return access.trial_days_remaining > 0
        ? `Trial active · ${access.trial_days_remaining} day${access.trial_days_remaining === 1 ? '' : 's'} left`
        : 'Trial ending soon';
    }
    if (access.status === 'active') {
      return `Active on ${access.plan.toUpperCase()} plan`;
    }
    return `Status: ${access.status}`;
  }, [access]);

  const upcomingInvoice = useMemo(
    () => invoices.find((invoice) => invoice.status === 'open' || invoice.status === 'draft'),
    [invoices]
  );

  const handlePortal = async () => {
    try {
      const url = await getPortalUrl();
      setPortalUrl(url);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open billing portal';
      setPortalError(message);
    }
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setProfileMessage(null);
    try {
      await updateBillingProfile(profileDraft);
      setProfileMessage('Billing profile updated.');
      void loadProfile();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      setProfileMessage(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !initialized) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-52 rounded-full bg-muted/80 animate-pulse" />
        <Skeleton className="h-[260px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-16">
      <section className="text-center">
        <header className="space-y-4">
          <span className="text-xs uppercase tracking-[0.4em] text-slate-500">Billing & plans</span>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">
            Manage your subscription, billing profile, and invoices in one place.
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-400">
            Update payment methods, download invoices, and keep your billing profile synced with finance.
          </p>
        </header>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={handlePortal}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 font-medium text-black shadow-inner-glow transition hover:bg-slate-200"
          >
            Open customer portal
          </button>
          <a
            href="#invoices"
            className="inline-flex items-center gap-2 rounded-full border border-outline/50 px-4 py-2 text-slate-200 transition hover:border-outline hover:text-white"
          >
            View invoices ↗
          </a>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-400">
          <a className="rounded-2xl border border-outline/40 bg-surface px-4 py-2 transition hover:border-outline hover:text-white" href="#subscription">
            Review subscription status ↗
          </a>
          <a className="rounded-2xl border border-outline/40 bg-surface px-4 py-2 transition hover:border-outline hover:text-white" href="#profile">
            Update billing details ↗
          </a>
          <a className="rounded-2xl border border-outline/40 bg-surface px-4 py-2 transition hover:border-outline hover:text-white" href="mailto:finance@cortexaai.net">
            Contact finance ↗
          </a>
        </div>
        {portalError && (
          <p className="mt-3 text-xs text-rose-300">{portalError}</p>
        )}
        {portalUrl && (
          <p className="mt-3 text-xs text-slate-500">
            Portal opened in a new tab. If nothing happened,{' '}
            <a href={portalUrl} target="_blank" rel="noreferrer" className="text-primary underline">
              click here
            </a>
            .
          </p>
        )}
      </section>

      {!canAccess && (
        <Paywall
          title="Plan inactive"
          description="Your AI access is paused. Update payment details or pick a plan to reactivate premium features."
          ctaLabel="Go to pricing"
        />
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-outline/40 bg-surface p-5 shadow-elevation-soft text-sm text-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current status</p>
          <p className="mt-2 text-lg font-semibold text-white">{statusCopy}</p>
          <p className="mt-3 text-xs text-slate-400">Plan changes apply instantly and never retro-charge your account.</p>
        </div>
        <div className="rounded-3xl border border-outline/40 bg-surface p-5 shadow-elevation-soft text-sm text-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-500">Upcoming invoice</p>
          {upcomingInvoice ? (
            <div className="mt-3 space-y-1 text-xs text-slate-300">
              <p>
                Amount:{' '}
                <span className="font-semibold text-white">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: upcomingInvoice.currency.toUpperCase(),
                  }).format(upcomingInvoice.amount_cents / 100)}
                </span>
              </p>
              <p>Status: {upcomingInvoice.status}</p>
              <p>Due date: {upcomingInvoice.due_at ? new Date(upcomingInvoice.due_at).toLocaleDateString() : '—'}</p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">No upcoming invoices yet.</p>
          )}
        </div>
        <div className="rounded-3xl border border-outline/40 bg-surface p-5 shadow-elevation-soft text-sm text-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-500">Support</p>
          <p className="mt-2 text-xs text-slate-400">
            Need billing help? Email{' '}
            <a href="mailto:finance@cortexaai.net" className="text-primary underline">
              finance@cortexaai.net
            </a>{' '}
            . Enterprise customers have a dedicated 24/5 Slack channel.
          </p>
        </div>
      </section>

      <section id="subscription" className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
          <h2 className="text-lg font-semibold text-white">Subscription details</h2>
          <p className="mt-2 text-sm text-slate-400">{statusCopy}</p>
          {subscription && (
            <dl className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <dt>Plan</dt>
                <dd className="text-white">{subscription.plan_name}</dd>
              </div>
              {subscription.trial_ends_at && (
                <div className="flex justify-between">
                  <dt>Trial ends</dt>
                  <dd>{new Date(subscription.trial_ends_at).toLocaleDateString()}</dd>
                </div>
              )}
              {subscription.current_period_end && (
                <div className="flex justify-between">
                  <dt>Renews</dt>
                  <dd>{new Date(subscription.current_period_end).toLocaleDateString()}</dd>
                </div>
              )}
            </dl>
          )}
          <button
            type="button"
            onClick={handlePortal}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-outline/50 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-outline hover:text-white"
          >
            Open portal ↗
          </button>
        </article>

        <aside className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft text-xs text-slate-300">
          <h3 className="text-lg font-semibold text-white">Need to downgrade?</h3>
          <p className="mt-2">Use the customer portal to switch plans or cancel. Changes apply immediately and you only pay pro-rated amounts.</p>
          <p className="mt-4">Looking for invoices older than 12 months? Reach out to <a className="text-primary underline" href="mailto:finance@cortexaai.net">finance@cortexaai.net</a>.</p>
        </aside>
      </section>

      <section id="profile" className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
        <h2 className="text-lg font-semibold text-white">Billing profile</h2>
        <p className="mt-2 text-sm text-slate-400">Keep company and tax details up to date so invoices remain compliant.</p>
        <form onSubmit={handleProfileSubmit} className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-slate-200">
          <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
            Country
            <input
              value={profileDraft.country}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, country: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
            VAT ID
            <input
              value={profileDraft.vat_id}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, vat_id: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
            Company name
            <input
              value={profileDraft.company_name}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, company_name: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
            Address line 1
            <input
              value={profileDraft.address_line1}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, address_line1: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
            Address line 2
            <input
              value={profileDraft.address_line2}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, address_line2: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
            City
            <input
              value={profileDraft.city}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, city: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
            Postal code
            <input
              value={profileDraft.postal_code}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, postal_code: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <div className="sm:col-span-2 flex items-center justify-between text-xs text-slate-500">
            <span>Updates apply immediately to future invoices.</span>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-inner-glow transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
          {profileMessage && (
            <p className="sm:col-span-2 text-xs text-slate-400">{profileMessage}</p>
          )}
        </form>
      </section>

      <section id="invoices" className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
        <h2 className="text-lg font-semibold text-white">Invoices</h2>
        <p className="mt-2 text-sm text-slate-400">Download past invoices for your records.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm text-slate-300">
            <thead>
              <tr className="border-b border-outline/30 text-xs uppercase tracking-[0.28em] text-slate-500">
                <th className="px-3 py-2 text-left">Invoice</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Issue date</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length ? (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-outline/20">
                    <td className="px-3 py-2 text-white">{invoice.provider_invoice_id}</td>
                    <td className="px-3 py-2 text-white">{invoice.status}</td>
                    <td className="px-3 py-2 text-right text-white">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: invoice.currency.toUpperCase(),
                      }).format(invoice.amount_cents / 100)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-accent space-x-3">
                      {invoice.hosted_invoice_url && (
                        <a href={invoice.hosted_invoice_url} target="_blank" rel="noreferrer" className="transition hover:text-white">
                          View
                        </a>
                      )}
                      {invoice.pdf_url && (
                        <a href={invoice.pdf_url} target="_blank" rel="noreferrer" className="transition hover:text-white">
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default BillingPage;
