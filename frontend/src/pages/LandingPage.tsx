import { CSSProperties, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import C from '@/styles/theme';

type IconProps = { color: string };
type Feature = {
  title: string;
  copy: string;
  metric: string;
  label: string;
  accent: string;
  bg: string;
  Icon: ({ color }: IconProps) => JSX.Element;
};

const iconStyle: CSSProperties = { width: 18, height: 18, display: 'block' };

const TrendIcon = ({ color }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" style={iconStyle} aria-hidden>
    <path d="M4 16L10 10L14 14L20 8" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 8H20V13" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BoltIcon = ({ color }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" style={iconStyle} aria-hidden>
    <path d="M13 2L5 13H11L10 22L19 10H13V2Z" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BrainIcon = ({ color }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" style={iconStyle} aria-hidden>
    <path d="M9 7A3 3 0 1 1 15 7A3 3 0 1 1 15 13H9A3 3 0 1 1 9 7Z" stroke={color} strokeWidth="1.8" />
    <path d="M9 13V17M15 13V17M12 5V3M12 21V17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const ShieldIcon = ({ color }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" style={iconStyle} aria-hidden>
    <path d="M12 3L19 6V11C19 15.2 16.1 18.8 12 20C7.9 18.8 5 15.2 5 11V6L12 3Z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M9.5 11.5L11.4 13.4L15 9.8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BarsIcon = ({ color }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" style={iconStyle} aria-hidden>
    <path d="M5 19V11M12 19V5M19 19V14" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
    <path d="M3 19.5H21" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);

const PulseIcon = ({ color }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" style={iconStyle} aria-hidden>
    <path d="M3 12H7L10 6L14 18L17 12H21" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const tickerItems = ['Real-time signals', 'AI confidence scoring', '180+ pairs', 'Regime detection', 'EMA + RSI + MACD', 'Binance automation', 'Risk-first workflows', 'Backtest-ready setups'];
const stats = [
  { value: '<2s', label: 'Signal latency' },
  { value: '180+', label: 'Tracked pairs' },
  { value: '24/7', label: 'Live monitoring' },
  { value: '65%+', label: 'Directional threshold' },
];

const features: Feature[] = [
  { title: 'Composite Signal Engine', copy: 'EMA, RSI, MACD, ADX, ATR and volume combine into one confidence-led trade read.', metric: '6', label: 'Indicator groups', accent: C.green, bg: C.greenMuted, Icon: TrendIcon },
  { title: 'Instant Execution', copy: 'Trigger market orders the moment a setup clears your threshold and risk rules.', metric: 'Now', label: 'Execution speed', accent: C.purple, bg: C.purpleMuted, Icon: BoltIcon },
  { title: 'Regime Awareness', copy: 'Separate trending, ranging and low-participation conditions before you commit size.', metric: '3', label: 'Market states', accent: C.amber, bg: C.amberMuted, Icon: BrainIcon },
  { title: 'Risk Controls', copy: 'ATR-based stop and target logic keeps every automation path disciplined by design.', metric: 'ATR', label: 'SL / TP model', accent: C.coral, bg: C.coralMuted, Icon: ShieldIcon },
  { title: 'Backtest Layer', copy: 'Validate thresholds and setups against historical candles before going live.', metric: 'Hist', label: 'Validation mode', accent: C.green, bg: C.greenMuted, Icon: BarsIcon },
  { title: 'Market Intel', copy: 'Read live flows, sentiment shifts and quality signals without leaving the workspace.', metric: 'Live', label: 'Context stream', accent: C.purple, bg: C.purpleMuted, Icon: PulseIcon },
];

const steps = [
  { number: '01', title: 'Create your workspace', copy: 'Open an account, choose a plan and unlock the live signal environment in minutes.', accent: C.green },
  { number: '02', title: 'Connect your flow', copy: 'Track signals only or add Binance trade permissions for automated execution.', accent: C.purple },
  { number: '03', title: 'Act with discipline', copy: 'Review setup quality, regime and score, then automate or route decisions with confidence.', accent: C.amber },
];

const plans = [
  { name: 'Starter', price: 'Free', meta: '7-day trial', copy: 'Explore the workspace and review core signal output.', items: ['Limited signal access', '3 pairs', 'Daily timeframe'], actionLabel: 'Get started', onNavigate: '/register' },
  { name: 'Premium', price: '$29', meta: 'per month', copy: 'Unlock full coverage, AI workflows and automated execution.', items: ['180+ pairs', 'AI advisor', 'Auto-execution', 'Backtest engine', 'Market intel'], actionLabel: 'Start premium', onNavigate: '/register?plan=premium', featured: true },
  { name: 'Enterprise', price: 'Custom', meta: 'volume based', copy: 'For teams that need integrations, seat controls and custom support.', items: ['API access', 'Priority support', 'Custom integration'], actionLabel: 'Contact sales', mailto: 'hello@cortexaai.net' },
];

const faqs = [
  { q: 'How is the score calculated?', a: 'The score blends trend structure, momentum, volume, regime fit and risk context into one weighted view.' },
  { q: 'Do I need an exchange API key?', a: 'No. You can use Cortexa as a signal terminal only. API keys are only needed for automation.' },
  { q: 'Is withdrawal access ever required?', a: 'No. Trade-only permissions are the intended path, and withdrawal access should stay disabled.' },
  { q: 'Can I cancel whenever I want?', a: 'Yes. Cancellation is immediate for future billing and access continues through the paid period.' },
  { q: 'Which markets are covered?', a: 'The product is designed around a broad crypto universe with 180+ tracked USDT pairs.' },
];

function NavButton({ label, onClick, filled }: { label: string; onClick: () => void; filled?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ borderRadius: 999, border: filled ? 'none' : `1px solid ${C.borderStrong}`, background: filled ? (hovered ? C.greenDark : C.green) : hovered ? C.surfaceHover : 'transparent', color: C.text, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.18s ease' }}
    >
      {label}
    </button>
  );
}

function SectionTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 40 }}>
      <div style={{ color: C.green, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>{eyebrow}</div>
      <h2 style={{ margin: '0 0 12px', fontSize: 42, lineHeight: 1.05, letterSpacing: '-0.04em', fontWeight: 800 }}>{title}</h2>
      <p style={{ margin: '0 auto', maxWidth: 640, color: C.textSub, fontSize: 16, lineHeight: 1.7 }}>{copy}</p>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroHover, setHeroHover] = useState(false);
  const [ctaHover, setCtaHover] = useState(false);
  const doubledTicker = useMemo(() => [...tickerItems, ...tickerItems], []);

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(circle at top left, ${C.greenFaint}, transparent 28%), radial-gradient(circle at top right, ${C.purpleMuted}, transparent 26%), ${C.bg}`, color: C.text, fontFamily: C.sans }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 20, padding: '18px 24px', borderBottom: `1px solid ${C.border}`, background: 'rgba(10,10,10,0.84)', backdropFilter: 'blur(16px)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: C.text, cursor: 'pointer', padding: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.28em' }}>CORTEXA</span>
          </button>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <NavButton label="Pricing" onClick={() => navigate('/pricing')} />
            <NavButton label="How it works" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
            <NavButton label="Launch app" onClick={() => navigate('/login')} filled />
          </div>
        </div>
      </nav>

      <section style={{ overflow: 'hidden', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', gap: 32, width: 'max-content', padding: '12px 0', animation: 'marquee 26s linear infinite' }}>
          {doubledTicker.map((item, index) => (
            <div key={`${item}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.textSub, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 16px ${C.green}` }} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '72px 24px 44px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: 28, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'stretch' }}>
          <div style={{ paddingTop: 20 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 999, border: `1px solid ${C.borderStrong}`, background: C.greenMuted, color: C.green, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 22 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} />
              AI Signal Intelligence
            </div>
            <h1 style={{ margin: '0 0 18px', fontSize: 72, lineHeight: 0.95, letterSpacing: '-0.06em', fontWeight: 900 }}>
              Find your edge.
              <span style={{ color: C.green, display: 'block' }}>Trade with structure.</span>
            </h1>
            <p style={{ margin: '0 0 30px', maxWidth: 580, color: C.textSub, fontSize: 18, lineHeight: 1.7 }}>Cortexa turns raw crypto noise into a focused trading terminal with signal scoring, regime detection, market context and automation-ready execution paths.</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={() => navigate('/register')} onMouseEnter={() => setHeroHover(true)} onMouseLeave={() => setHeroHover(false)} style={{ border: 'none', borderRadius: 14, background: heroHover ? C.greenDark : C.green, color: C.text, padding: '16px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.18s ease' }}>
                Start free trial
              </button>
              <button type="button" onClick={() => navigate('/pricing')} style={{ border: `1px solid ${C.borderStrong}`, borderRadius: 14, background: 'transparent', color: C.text, padding: '16px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                View pricing
              </button>
              <span style={{ color: C.textMuted, fontSize: 12, fontFamily: C.mono, letterSpacing: '0.08em', textTransform: 'uppercase' }}>No card required</span>
            </div>
          </div>

          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 28, border: `1px solid ${C.borderStrong}`, background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))', padding: 28, minHeight: 420 }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at top right, ${C.greenMuted}, transparent 28%), radial-gradient(circle at bottom left, ${C.purpleMuted}, transparent 30%)` }} />
            <div style={{ position: 'relative', display: 'grid', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>Live cockpit</div>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>BTC / USDT</div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 999, background: C.greenMuted, color: C.green, fontFamily: C.mono, fontSize: 12 }}>Score 78%</div>
              </div>

              <div style={{ borderRadius: 22, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', padding: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                  {[{ label: 'Edge', value: 'Long' }, { label: 'Regime', value: 'Trending' }, { label: 'Latency', value: '<2s' }].map((item) => (
                    <div key={item.label} style={{ padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
                      <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>{item.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, height: 220, borderRadius: 20, background: 'linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.05))', border: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
                  <svg viewBox="0 0 600 240" fill="none" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                    <path d="M0 170C40 168 80 130 120 132C160 134 200 92 240 98C280 104 320 56 360 72C400 88 440 36 480 58C520 80 560 56 600 24" stroke={C.green} strokeWidth="4" strokeLinecap="round" />
                    <path d="M0 190C40 186 80 154 120 158C160 162 200 110 240 124C280 138 320 98 360 104C400 110 440 70 480 82C520 94 560 72 600 60V240H0V190Z" fill="rgba(29,158,117,0.12)" />
                  </svg>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {['AI advisor ready', 'Risk controls armed', 'Automation optional'].map((chip) => (
                  <div key={chip} style={{ padding: '10px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, color: C.textSub, fontSize: 13 }}>{chip}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {stats.map((stat) => (
            <div key={stat.label} style={{ padding: '30px 24px', borderRight: `1px solid ${C.border}` }}>
              <div style={{ color: C.green, fontSize: 34, fontWeight: 800, fontFamily: C.mono, marginBottom: 6 }}>{stat.value}</div>
              <div style={{ color: C.textMuted, fontSize: 11, fontFamily: C.mono, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '84px 24px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <SectionTitle eyebrow="Features" title="Everything needed for a sharper trading loop" copy="Built to move from signal discovery to execution without losing context, speed or discipline." />
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {features.map((feature) => (
              <div key={feature.title} style={{ borderRadius: 22, border: `1px solid ${C.border}`, background: C.surface, padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: feature.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <feature.Icon color={feature.accent} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: feature.accent, fontSize: 20, fontWeight: 700, fontFamily: C.mono }}>{feature.metric}</div>
                    <div style={{ color: C.textMuted, fontSize: 10, fontFamily: C.mono, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>{feature.label}</div>
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{feature.title}</div>
                <div style={{ color: C.textSub, fontSize: 14, lineHeight: 1.7 }}>{feature.copy}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" style={{ padding: '0 24px 84px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <SectionTitle eyebrow="How it works" title="Three steps from setup to signal action" copy="Keep the workflow simple: onboard, connect what you need, then execute with a much clearer view of risk and quality." />
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {steps.map((step) => (
              <div key={step.number} style={{ borderRadius: 24, border: `1px solid ${C.border}`, background: C.surface, padding: 24 }}>
                <div style={{ color: step.accent, fontSize: 28, fontWeight: 800, fontFamily: C.mono, marginBottom: 18 }}>{step.number}</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>{step.title}</div>
                <div style={{ color: C.textSub, lineHeight: 1.7, fontSize: 15 }}>{step.copy}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 24px 84px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <SectionTitle eyebrow="Pricing" title="Start light, scale when your process is ready" copy="Choose the setup that matches your desk, automation needs and market coverage." />
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {plans.map((plan) => (
              <div key={plan.name} style={{ borderRadius: 24, border: plan.featured ? `2px solid ${C.green}` : `1px solid ${C.border}`, background: plan.featured ? 'rgba(29,158,117,0.06)' : C.surface, padding: 24, position: 'relative' }}>
                {plan.featured ? <div style={{ position: 'absolute', top: -12, left: 24, borderRadius: 999, background: C.green, color: C.bg, padding: '5px 12px', fontSize: 11, fontFamily: C.mono, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Most popular</div> : null}
                <div style={{ color: plan.featured ? C.green : C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>{plan.name}</div>
                <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 4 }}>{plan.price}</div>
                <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 12, marginBottom: 12 }}>{plan.meta}</div>
                <div style={{ color: C.textSub, lineHeight: 1.7, fontSize: 14, marginBottom: 18 }}>{plan.copy}</div>
                <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
                  {plan.items.map((item) => (
                    <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: C.textSub, fontSize: 14 }}>
                      <span style={{ color: C.green, fontWeight: 700 }}>+</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (plan.mailto) {
                      window.location.href = `mailto:${plan.mailto}`;
                      return;
                    }
                    navigate(plan.onNavigate!);
                  }}
                  style={{ width: '100%', borderRadius: 14, border: plan.featured ? 'none' : `1px solid ${C.borderStrong}`, background: plan.featured ? C.green : 'transparent', color: C.text, padding: '14px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
                >
                  {plan.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 24px 84px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <SectionTitle eyebrow="FAQ" title="Questions traders ask before they commit" copy="The short version on scoring, security, APIs and plan flexibility." />
          <div style={{ borderTop: `1px solid ${C.border}` }}>
            {faqs.map((faq, index) => (
              <div key={faq.q} style={{ borderBottom: `1px solid ${C.border}` }}>
                <button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} style={{ width: '100%', background: 'none', border: 'none', color: C.text, cursor: 'pointer', padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, textAlign: 'left', fontSize: 16, fontWeight: 700 }}>
                  <span>{faq.q}</span>
                  <span style={{ color: C.textSub, fontSize: 24, lineHeight: 1 }}>{openFaq === index ? '-' : '+'}</span>
                </button>
                {openFaq === index ? <div style={{ padding: '0 0 20px', color: C.textSub, lineHeight: 1.8, fontSize: 14 }}>{faq.a}</div> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 24px 72px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', borderRadius: 28, border: `1px solid ${C.borderStrong}`, background: 'linear-gradient(135deg, rgba(29,158,117,0.12), rgba(255,255,255,0.03))', padding: 32 }}>
          <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', alignItems: 'center' }}>
            <div>
              <div style={{ color: C.green, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Ready when you are</div>
              <div style={{ fontSize: 40, lineHeight: 1.02, fontWeight: 800, marginBottom: 12 }}>Trade with a clearer system, not more noise.</div>
              <div style={{ color: C.textSub, fontSize: 15, lineHeight: 1.7 }}>Start with the free trial, review live signals, then decide if automation and deeper tooling fit your workflow.</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => navigate('/register')} onMouseEnter={() => setCtaHover(true)} onMouseLeave={() => setCtaHover(false)} style={{ border: 'none', borderRadius: 14, background: ctaHover ? C.greenDark : C.green, color: C.text, padding: '16px 22px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                Start free
              </button>
              <button type="button" onClick={() => navigate('/login')} style={{ borderRadius: 14, border: `1px solid ${C.borderStrong}`, background: 'transparent', color: C.text, padding: '16px 22px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                Sign in
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ padding: '24px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 12 }}>© {new Date().getFullYear()} Cortexa</div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {[
              { label: 'Pricing', onClick: () => navigate('/pricing') },
              { label: 'Login', onClick: () => navigate('/login') },
              { label: 'Support', onClick: () => { window.location.href = 'mailto:hello@cortexaai.net'; } },
            ].map((item) => (
              <button key={item.label} type="button" onClick={item.onClick} style={{ background: 'none', border: 'none', color: C.textSub, cursor: 'pointer', padding: 0, fontSize: 13 }}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
