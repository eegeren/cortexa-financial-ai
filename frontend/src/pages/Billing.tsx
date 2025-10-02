import { FormEvent, useEffect, useMemo, useState } from 'react';
import Card from '@/components/Card';
import PageHeader from '@/components/PageHeader';
import Skeleton from '@/components/Skeleton';
import Paywall from '@/components/Paywall';
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
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

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
      setProfileMessage('Billing profile updated');
      void loadProfile();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      setProfileMessage(message);
    } finally {
      setSaving(false);
    }
  };

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

  if (loading || !initialized) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[280px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Billing" description="Manage your subscription, invoices, and billing profile." />

      {!canAccess && (
        <Paywall
          title="Plan inactive"
          description="Your AI access is paused. Update payment details or pick a plan to reactivate premium features."
          ctaLabel="Go to pricing"
        />
      )}

      <Card className="border border-slate-800/60 bg-slate-900/70 p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-white">Subscription</h3>
            <p className="mt-2 text-sm text-slate-300">{statusCopy}</p>
            {subscription && (
              <dl className="mt-4 space-y-2 text-sm text-slate-400">
                <div className="flex justify-between">
                  <dt>Plan</dt>
                  <dd className="text-slate-200">{subscription.plan_name}</dd>
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
              className="mt-5 inline-flex items-center rounded-full border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary hover:text-white"
            >
              Open customer portal
            </button>
            {portalUrl && (
              <p className="mt-2 text-xs text-slate-500">
                Portal opened in a new tab. If it did not open,{' '}
                <a className="text-primary underline" href={portalUrl} target="_blank" rel="noreferrer">
                  click here
                </a>
                .
              </p>
            )}
            {portalError && <p className="mt-2 text-xs text-rose-300">{portalError}</p>}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Billing profile</h3>
            <form onSubmit={handleProfileSubmit} className="mt-4 grid gap-3 text-sm">
              <div className="grid gap-2">
                <label htmlFor="country" className="text-xs uppercase tracking-wide text-slate-500">
                  Country
                </label>
                <input
                  id="country"
                  value={profileDraft.country}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, country: event.target.value }))}
                  className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="vat" className="text-xs uppercase tracking-wide text-slate-500">
                  VAT / Tax ID
                </label>
                <input
                  id="vat"
                  value={profileDraft.vat_id}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, vat_id: event.target.value }))}
                  className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="company" className="text-xs uppercase tracking-wide text-slate-500">
                  Company name
                </label>
                <input
                  id="company"
                  value={profileDraft.company_name}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, company_name: event.target.value }))}
                  className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="address1" className="text-xs uppercase tracking-wide text-slate-500">
                  Address line 1
                </label>
                <input
                  id="address1"
                  value={profileDraft.address_line1}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, address_line1: event.target.value }))}
                  className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="address2" className="text-xs uppercase tracking-wide text-slate-500">
                  Address line 2
                </label>
                <input
                  id="address2"
                  value={profileDraft.address_line2}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, address_line2: event.target.value }))}
                  className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="city" className="text-xs uppercase tracking-wide text-slate-500">
                  City
                </label>
                <input
                  id="city"
                  value={profileDraft.city}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, city: event.target.value }))}
                  className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="postal" className="text-xs uppercase tracking-wide text-slate-500">
                  Postal code
                </label>
                <input
                  id="postal"
                  value={profileDraft.postal_code}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, postal_code: event.target.value }))}
                  className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              {profileMessage && <p className="text-xs text-slate-400">{profileMessage}</p>}
            </form>
          </div>
        </div>
      </Card>

      <Card className="border border-slate-800/60 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold text-white">Invoices</h3>
        {invoices.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Invoices will appear here once billing events are generated.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">Issued</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="py-3">
                      {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: invoice.currency.toUpperCase(),
                      }).format(invoice.amount_cents / 100)}
                    </td>
                    <td className="py-3 capitalize">{invoice.status.replace('_', ' ')}</td>
                    <td className="py-3">
                      <div className="flex gap-3">
                        {invoice.hosted_invoice_url && (
                          <a
                            href={invoice.hosted_invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            View
                          </a>
                        )}
                        {invoice.pdf_url && (
                          <a href={invoice.pdf_url} target="_blank" rel="noreferrer" className="text-primary underline">
                            PDF
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default BillingPage;
