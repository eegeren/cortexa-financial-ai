import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import usePremiumStatus from '@/hooks/usePremiumStatus';
import { useAuthStore } from '@/store/auth';
import { createCheckoutSession } from '@/services/api';

const ACCENT = '#1D9E75';
const ACCENT_DARK = '#0F6E56';
const BG = '#0a0a0a';
const MONO = 'DM Mono, monospace';
const SANS = 'Inter, system-ui, sans-serif';

const CheckMark = ({ color = ACCENT }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
    <path d="M20 6L9 17L4 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CrossMark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
    <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const TrustCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden>
    <circle cx="12" cy="12" r="10" stroke={ACCENT} strokeWidth="1.5" />
    <path d="M8 12L11 15L16 9" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const STARTER_FEATURES: { text: string; enabled: boolean }[] = [
  { text: 'Up to 10 signals/day', enabled: true },
  { text: '3 pairs (BTC, ETH, SOL)', enabled: true },
  { text: 'Daily timeframe only', enabled: true },
  { text: 'Basic NLP summary', enabled: true },
  { text: 'Auto-execution', enabled: false },
  { text: 'AI advisor', enabled: false },
  { text: 'Backtest engine', enabled: false },
];

const PREMIUM_FEATURES = [
  'Unlimited signals',
  '180+ pairs · all timeframes',
  'Auto-execution (Binance)',
  'AI advisor (GPT-4o)',
  'Backtest engine',
  'Market intel (Fear & Greed, whale alerts)',
  'ATR-based SL/TP auto-set',
  'Confidence score breakdown',
];

const ENTERPRISE_FEATURES = [
  'Unlimited signals · API access',
  'Custom pair configuration',
  'Dedicated infrastructure',
  'White-label option',
  'SLA & priority support',
  'Custom integrations',
];

const TABLE_ROWS = [
  { feature: 'Daily signals',        starter: '10/day',   premium: 'Unlimited' },
  { feature: 'Pairs',                starter: '3',        premium: '180+' },
  { feature: 'Timeframes',           starter: '1D only',  premium: '1H · 4H · 1D' },
  { feature: 'Auto-execution',       starter: '✗',        premium: '✓' },
  { feature: 'AI advisor',           starter: '✗',        premium: '✓' },
  { feature: 'Backtest engine',      starter: '✗',        premium: '✓' },
  { feature: 'Confidence breakdown', starter: 'Basic',    premium: 'Full' },
  { feature: 'Market intelligence',  starter: '✗',        premium: '✓' },
  { feature: 'SL/TP auto-set',       starter: '✗',        premium: '✓' },
];

const TRUST_ITEMS = [
  'AES-256 Encryption',
  'Trade-only API access',
  'Cancel anytime',
  '7-day free trial',
];

const FAQS = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes — one click, instant. Access continues until end of billing period.',
  },
  {
    q: 'Is my Binance API key safe?',
    a: 'Your key is encrypted with AES-256-GCM. We only request trade permission — withdrawal access is never asked.',
  },
  {
    q: 'What happens after the free trial?',
    a: "You'll be prompted to choose a plan. If you don't upgrade, your account moves to read-only mode — no charges, ever.",
  },
];

const PricingPage = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const { isPremium } = usePremiumStatus();
  const [ctaState, setCtaState] = useState<'idle' | 'loading' | 'redirecting'>('idle');
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [premHovered, setPremHovered] = useState(false);
  const [starterHovered, setStarterHovered] = useState(false);
  const [entHovered, setEntHovered] = useState(false);

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
        if (typeof detail === 'string' && detail.trim()) {
          message = detail.trim();
        } else if (detail && typeof detail === 'object') {
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

  const premiumButtonLabel = () => {
    if (ctaState === 'loading') return 'Preparing checkout…';
    if (ctaState === 'redirecting') return 'Redirecting…';
    return 'Start 7-Day Free Trial →';
  };

  const cardBase = {
    borderRadius: 16,
    padding: 28,
  };

  return (
    <div style={{ background: BG, minHeight: '100vh', padding: '80px 48px', fontFamily: SANS, color: '#ffffff' }}>

      {/* ── 1. HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <div style={{
          fontSize: 11, color: ACCENT, fontFamily: MONO, letterSpacing: '0.12em',
          textTransform: 'uppercase', marginBottom: 12,
        }}>
          PRICING
        </div>
        <h1 style={{
          fontSize: 52, fontWeight: 900, letterSpacing: -2, color: '#ffffff',
          margin: '0 0 12px', lineHeight: 1.05,
        }}>
          Choose Your Edge
        </h1>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
          Start free. Upgrade when you're ready.
        </p>
      </div>

      {/* ── 2. PLAN GRID ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
        gap: 16, maxWidth: 960, margin: '0 auto 64px',
      }}>

        {/* STARTER */}
        <div style={{ ...cardBase, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{
            fontSize: 11, fontFamily: MONO, color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20,
          }}>
            STARTER
          </div>
          <div style={{ fontSize: 42, fontWeight: 900, color: '#ffffff', marginBottom: 2 }}>Free</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontFamily: MONO, marginBottom: 24 }}>
            7-day trial · no card required
          </div>
          <div>
            {STARTER_FEATURES.map((item) => (
              <div key={item.text} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                {item.enabled ? <CheckMark /> : <CrossMark />}
                <span style={{
                  fontSize: 14,
                  color: item.enabled ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                }}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate('/register')}
            onMouseEnter={() => setStarterHovered(true)}
            onMouseLeave={() => setStarterHovered(false)}
            style={{
              border: '1px solid rgba(255,255,255,0.15)',
              background: starterHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
              color: '#ffffff', width: '100%', padding: 12, borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 24,
              fontFamily: SANS, transition: 'background 0.18s ease',
            }}
          >
            Get Started Free
          </button>
        </div>

        {/* PREMIUM — FEATURED */}
        <div style={{
          ...cardBase, border: '2px solid #1D9E75',
          background: 'rgba(29,158,117,0.04)', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
            background: ACCENT, color: '#0a0a0a', fontSize: 11, fontWeight: 700,
            fontFamily: MONO, letterSpacing: '0.1em', padding: '4px 14px',
            borderRadius: 20, whiteSpace: 'nowrap',
          }}>
            MOST POPULAR
          </div>
          <div style={{
            fontSize: 11, fontFamily: MONO, color: ACCENT,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20,
          }}>
            PREMIUM
          </div>
          <div style={{ fontSize: 42, fontWeight: 900, color: '#ffffff', marginBottom: 2 }}>$29</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontFamily: MONO, marginBottom: 24 }}>
            / month · $290/year (save 17%)
          </div>
          <div>
            {PREMIUM_FEATURES.map((text) => (
              <div key={text} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                <CheckMark color={ACCENT} />
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>{text}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={ctaState !== 'idle'}
            onMouseEnter={() => setPremHovered(true)}
            onMouseLeave={() => setPremHovered(false)}
            style={{
              background: premHovered ? ACCENT_DARK : ACCENT, border: 'none',
              color: '#ffffff', width: '100%', padding: 12, borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              cursor: ctaState !== 'idle' ? 'not-allowed' : 'pointer',
              marginTop: 24, fontFamily: SANS,
              opacity: ctaState !== 'idle' ? 0.7 : 1,
              transition: 'background 0.18s ease',
            }}
          >
            {premiumButtonLabel()}
          </button>
          {ctaError && (
            <p style={{ fontSize: 12, color: '#f87171', marginTop: 8, textAlign: 'center' }}>
              {ctaError}
            </p>
          )}
        </div>

        {/* ENTERPRISE */}
        <div style={{ ...cardBase, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{
            fontSize: 11, fontFamily: MONO, color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20,
          }}>
            ENTERPRISE
          </div>
          <div style={{ fontSize: 42, fontWeight: 900, color: '#ffffff', marginBottom: 2 }}>Custom</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontFamily: MONO, marginBottom: 24 }}>
            Volume-based pricing
          </div>
          <div>
            {ENTERPRISE_FEATURES.map((text) => (
              <div key={text} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                <CheckMark />
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{text}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { window.location.href = 'mailto:hello@cortexaai.net'; }}
            onMouseEnter={() => setEntHovered(true)}
            onMouseLeave={() => setEntHovered(false)}
            style={{
              border: '1px solid rgba(255,255,255,0.15)',
              background: entHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
              color: '#ffffff', width: '100%', padding: 12, borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 24,
              fontFamily: SANS, transition: 'background 0.18s ease',
            }}
          >
            Contact Us →
          </button>
        </div>
      </div>

      {/* ── 3. COMPARISON TABLE ───────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: '0 auto 64px' }}>
        <h2 style={{
          fontSize: 28, fontWeight: 800, textAlign: 'center',
          marginBottom: 32, color: '#ffffff',
        }}>
          Free vs Premium
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              <th style={{
                fontSize: 12, fontFamily: MONO, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.08em', padding: '12px 20px', textAlign: 'left',
                fontWeight: 500,
              }}>
                Feature
              </th>
              <th style={{
                fontSize: 12, fontFamily: MONO, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.08em', padding: '12px 20px', textAlign: 'center',
                fontWeight: 500,
              }}>
                Starter
              </th>
              <th style={{
                fontSize: 12, fontFamily: MONO, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.08em', padding: '12px 20px', textAlign: 'center',
                fontWeight: 500,
              }}>
                Premium
              </th>
            </tr>
          </thead>
          <tbody>
            {TABLE_ROWS.map((row) => (
              <tr key={row.feature} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '14px 20px', fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'left' }}>
                  {row.feature}
                </td>
                <td style={{
                  padding: '14px 20px', fontSize: 14, textAlign: 'center',
                  color: row.starter === '✗' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)',
                }}>
                  {row.starter}
                </td>
                <td style={{
                  padding: '14px 20px', fontSize: 14, textAlign: 'center',
                  color: ACCENT,
                  fontWeight: row.premium === '✓' ? 700 : 500,
                }}>
                  {row.premium}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 4. TRUST ROW ──────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 600, margin: '0 auto 64px',
        display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap',
      }}>
        {TRUST_ITEMS.map((item) => (
          <div key={item} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: 'rgba(255,255,255,0.4)',
          }}>
            <TrustCheck />
            <span>{item}</span>
          </div>
        ))}
      </div>

      {/* ── 5. FAQ ────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {FAQS.map((faq, i) => (
          <div key={faq.q} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <button
              type="button"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                color: '#ffffff', fontSize: 15, fontWeight: 600, padding: '20px 0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', fontFamily: SANS, gap: 16,
              }}
            >
              <span>{faq.q}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20, flexShrink: 0, lineHeight: 1 }}>
                {openFaq === i ? '−' : '+'}
              </span>
            </button>
            {openFaq === i && (
              <div style={{
                fontSize: 14, color: 'rgba(255,255,255,0.45)',
                lineHeight: 1.7, paddingBottom: 20,
              }}>
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
};

export default PricingPage;
