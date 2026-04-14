import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import usePremiumStatus from '@/hooks/usePremiumStatus';
import { useAuthStore } from '@/store/auth';
import { createCheckoutSession } from '@/services/api';
import C from '@/styles/theme';

const starterFeatures: Array<{ text: string; enabled: boolean }> = [
  { text: 'Up to 10 signals per day', enabled: true },
  { text: '3 pairs included', enabled: true },
  { text: 'Daily timeframe only', enabled: true },
  { text: 'Basic NLP summary', enabled: true },
  { text: 'Auto-execution', enabled: false },
  { text: 'AI advisor', enabled: false },
  { text: 'Backtest engine', enabled: false },
];

const premiumFeatures = [
  'Unlimited signals',
  '180+ pairs across timeframes',
  'Auto-execution (Binance)',
  'AI advisor',
  'Backtest engine',
  'Market intel',
  'ATR-based SL / TP',
  'Confidence score breakdown',
];

const enterpriseFeatures = [
  'Unlimited signals and API access',
  'Custom pair configuration',
  'Dedicated infrastructure',
  'White-label options',
  'Priority support',
  'Custom integrations',
];

const tableRows = [
  { feature: 'Daily signals', starter: '10/day', premium: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'Pairs', starter: '3', premium: '180+', enterprise: 'Custom' },
  { feature: 'Timeframes', starter: '1D only', premium: '15m · 1h · 4h · 1D', enterprise: 'Custom' },
  { feature: 'Auto-execution', starter: 'No', premium: 'Yes', enterprise: 'Yes' },
  { feature: 'AI advisor', starter: 'No', premium: 'Yes', enterprise: 'Yes' },
  { feature: 'Backtest engine', starter: 'No', premium: 'Yes', enterprise: 'Yes' },
  { feature: 'Support', starter: 'Community', premium: 'Priority email', enterprise: 'Dedicated' },
];

const trustItems = ['AES-256 encryption', 'Trade-only API access', 'Cancel anytime', '7-day free trial'];

const faqs = [
  { q: 'Can I cancel anytime?', a: 'Yes. Cancellation stops future billing immediately and access continues until the current paid period ends.' },
  { q: 'Is my Binance API key safe?', a: 'Your key is encrypted and intended for trade-only permissions. Withdrawal access should remain disabled.' },
  { q: 'What happens after the free trial?', a: 'You can upgrade into Premium or stay on the lighter starter experience without surprise charges.' },
];

function CheckIcon({ enabled = true }: { enabled?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      {enabled ? (
        <path d="M20 6L9 17L4 12" stroke={C.green} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M18 6L6 18M6 6l12 12" stroke={C.textMuted} strokeWidth="2.1" strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const { isPremium } = usePremiumStatus();
  const [ctaState, setCtaState] = useState<'idle' | 'loading' | 'redirecting'>('idle');
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleUpgrade = async () => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setCtaState('loading');
    setCtaError(null);
    try {
      const session = await createCheckoutSession({
        plan_code: 'premium',
        success_url: `${window.location.origin}/billing?checkout=success`,
        cancel_url: `${window.location.origin}/pricing`,
      });
      setCtaState('redirecting');
      window.location.href = session.checkout_url;
    } catch (err) {
      let message = 'Checkout failed';
      if (isAxiosError(err)) {
        const detail = err.response?.data;
        if (typeof detail === 'string' && detail.trim()) message = detail.trim();
        else if (detail && typeof detail === 'object') {
          const knownMessage =
            ('message' in detail && typeof detail.message === 'string' && detail.message) ||
            ('error' in detail && typeof detail.error === 'string' && detail.error) ||
            ('detail' in detail && typeof detail.detail === 'string' && detail.detail);
          if (knownMessage) message = knownMessage;
        }
      } else if (err instanceof Error && err.message) {
        message = err.message;
      }
      setCtaError(message);
      setCtaState('idle');
    }
  };

  const premiumLabel = ctaState === 'loading' ? 'Preparing checkout...' : ctaState === 'redirecting' ? 'Redirecting...' : isPremium ? 'Manage premium' : 'Start 7-day free trial';

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(circle at top left, ${C.greenFaint}, transparent 24%), radial-gradient(circle at top right, ${C.purpleMuted}, transparent 26%), ${C.bg}`, color: C.text, fontFamily: C.sans, padding: '32px 20px 64px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: 32 }}>
        <section style={{ textAlign: 'center', paddingTop: 20 }}>
          <div style={{ color: C.green, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Pricing</div>
          <h1 style={{ margin: '0 0 12px', fontSize: 56, lineHeight: 1.02, letterSpacing: '-0.05em' }}>Choose the plan that fits your trading flow.</h1>
          <p style={{ margin: '0 auto', maxWidth: 720, color: C.textSub, fontSize: 16, lineHeight: 1.7 }}>Start light, move into full signal coverage when you need it, and scale into enterprise workflows only when the desk actually asks for them.</p>
        </section>

        <section style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div style={{ borderRadius: 26, border: `1px solid ${C.border}`, background: C.surface, padding: 24 }}>
            <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Starter</div>
            <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 4 }}>Free</div>
            <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 12, marginBottom: 14 }}>7-day trial • no card</div>
            <div style={{ color: C.textSub, fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>A lighter way to explore the workspace before you commit to full signal flow.</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {starterFeatures.map((item) => (
                <div key={item.text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: item.enabled ? C.textSub : C.textMuted, fontSize: 14 }}>
                  <CheckIcon enabled={item.enabled} />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => navigate('/register')} style={{ width: '100%', marginTop: 22, borderRadius: 14, border: `1px solid ${C.borderStrong}`, background: 'transparent', color: C.text, padding: '14px 16px', cursor: 'pointer', fontWeight: 700 }}>
              Get started
            </button>
          </div>

          <div style={{ borderRadius: 26, border: `2px solid ${C.green}`, background: 'rgba(29,158,117,0.06)', padding: 24, position: 'relative' }}>
            <div style={{ position: 'absolute', top: -12, left: 24, borderRadius: 999, background: C.green, color: C.bg, padding: '5px 12px', fontSize: 11, fontFamily: C.mono, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Most popular</div>
            <div style={{ color: C.green, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Premium</div>
            <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 4 }}>$29</div>
            <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 12, marginBottom: 14 }}>per month</div>
            <div style={{ color: C.textSub, fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>Full signal coverage, deeper context, AI help and automation-ready execution.</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {premiumFeatures.map((item) => (
                <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: C.textSub, fontSize: 14 }}>
                  <CheckIcon />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={isPremium ? () => navigate('/billing') : handleUpgrade} disabled={ctaState !== 'idle' && !isPremium} style={{ width: '100%', marginTop: 22, borderRadius: 14, border: 'none', background: C.green, color: C.text, padding: '14px 16px', cursor: ctaState !== 'idle' && !isPremium ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: ctaState !== 'idle' && !isPremium ? 0.75 : 1 }}>
              {premiumLabel}
            </button>
            {ctaError ? <div style={{ marginTop: 10, color: '#fda4af', fontSize: 12 }}>{ctaError}</div> : null}
          </div>

          <div style={{ borderRadius: 26, border: `1px solid ${C.border}`, background: C.surface, padding: 24 }}>
            <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Enterprise</div>
            <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 4 }}>Custom</div>
            <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 12, marginBottom: 14 }}>volume based</div>
            <div style={{ color: C.textSub, fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>For teams that need bespoke coverage, integrations, seats and support models.</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {enterpriseFeatures.map((item) => (
                <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: C.textSub, fontSize: 14 }}>
                  <CheckIcon />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => { window.location.href = 'mailto:hello@cortexaai.net'; }} style={{ width: '100%', marginTop: 22, borderRadius: 14, border: `1px solid ${C.borderStrong}`, background: 'transparent', color: C.text, padding: '14px 16px', cursor: 'pointer', fontWeight: 700 }}>
              Contact sales
            </button>
          </div>
        </section>

        <section style={{ borderRadius: 28, border: `1px solid ${C.border}`, background: C.surface, padding: 24 }}>
          <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 16, textAlign: 'center' }}>Plan comparison</div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 720 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 12, padding: '0 0 14px', borderBottom: `1px solid ${C.border}` }}>
                {['Feature', 'Starter', 'Premium', 'Enterprise'].map((item) => (
                  <div key={item} style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{item}</div>
                ))}
              </div>
              {tableRows.map((row) => (
                <div key={row.feature} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 12, padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ color: C.text, fontWeight: 600 }}>{row.feature}</div>
                  <div style={{ color: C.textSub }}>{row.starter}</div>
                  <div style={{ color: C.green, fontWeight: 700 }}>{row.premium}</div>
                  <div style={{ color: C.textSub }}>{row.enterprise}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
          {trustItems.map((item) => (
            <div key={item} style={{ borderRadius: 999, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)', padding: '12px 16px', color: C.textSub, fontSize: 13 }}>
              {item}
            </div>
          ))}
        </section>

        <section style={{ maxWidth: 860, width: '100%', margin: '0 auto' }}>
          <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, textAlign: 'center' }}>Common questions</div>
          <div style={{ borderTop: `1px solid ${C.border}` }}>
            {faqs.map((faq, index) => (
              <div key={faq.q} style={{ borderBottom: `1px solid ${C.border}` }}>
                <button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} style={{ width: '100%', background: 'none', border: 'none', color: C.text, cursor: 'pointer', padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', gap: 16, fontSize: 16, fontWeight: 700 }}>
                  <span>{faq.q}</span>
                  <span style={{ color: C.textSub, fontSize: 24, lineHeight: 1 }}>{openFaq === index ? '-' : '+'}</span>
                </button>
                {openFaq === index ? <div style={{ padding: '0 0 20px', color: C.textSub, fontSize: 14, lineHeight: 1.8 }}>{faq.a}</div> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
