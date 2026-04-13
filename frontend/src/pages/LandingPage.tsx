import { CSSProperties, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ACCENT = '#1D9E75';
const ACCENT_DARK = '#0F6E56';
const BG = '#0a0a0a';
const MONO = 'DM Mono, monospace';
const SANS = 'Inter, system-ui, sans-serif';

type IconComponent = ({ color }: { color: string }) => JSX.Element;

type FeatureItem = {
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
  metricColor: string;
  iconBg: string;
  iconColor: string;
  Icon: IconComponent;
};

type PlanItem = {
  name: string;
  price: string;
  period: string;
  featured?: boolean;
  items: string[];
  action: () => void;
  buttonLabel: string;
};

type StepItem = {
  number: string;
  color: string;
  title: string;
  description: string;
};

const iconBase: CSSProperties = {
  width: 16,
  height: 16,
  display: 'block',
};

const TrendingUpIcon: IconComponent = ({ color }) => (
  <svg viewBox="0 0 24 24" fill="none" style={iconBase} aria-hidden>
    <path d="M4 16L10 10L14 14L20 8" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 8H20V13" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ZapIcon: IconComponent = ({ color }) => (
  <svg viewBox="0 0 24 24" fill="none" style={iconBase} aria-hidden>
    <path d="M13 2L5 13H11L10 22L19 10H13L13 2Z" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ClockIcon: IconComponent = ({ color }) => (
  <svg viewBox="0 0 24 24" fill="none" style={iconBase} aria-hidden>
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.9" />
    <path d="M12 7V12L15 14" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MessageSquareIcon: IconComponent = ({ color }) => (
  <svg viewBox="0 0 24 24" fill="none" style={iconBase} aria-hidden>
    <path d="M5 6.5C5 5.12 6.12 4 7.5 4H16.5C17.88 4 19 5.12 19 6.5V13.5C19 14.88 17.88 16 16.5 16H10L6 19V16.2C5.42 15.86 5 15.24 5 14.5V6.5Z" stroke={color} strokeWidth="1.9" strokeLinejoin="round" />
  </svg>
);

const BarChart2Icon: IconComponent = ({ color }) => (
  <svg viewBox="0 0 24 24" fill="none" style={iconBase} aria-hidden>
    <path d="M5 19V11M12 19V5M19 19V14" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
    <path d="M3 19.5H21" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);

const ActivityIcon: IconComponent = ({ color }) => (
  <svg viewBox="0 0 24 24" fill="none" style={iconBase} aria-hidden>
    <path d="M3 12H7L10 6L14 18L17 12H21" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const tickerBase = [
  'Real-time signals',
  'Auto-execution',
  'Confidence score',
  'Regime detection',
  'ATR-based SL/TP',
  '180+ pairs',
  'EMA',
  'RSI',
  'MACD',
  'Whale alerts',
  'Fear & Greed',
  '24/7 live',
];

const stats = [
  { value: '< 2s', label: 'SIGNAL SPEED' },
  { value: '180+', label: 'PAIRS' },
  { value: '6', label: 'INDICATOR GROUPS' },
  { value: '24/7', label: 'LIVE 24/7' },
];

const features: FeatureItem[] = [
  {
    title: 'Signal Engine',
    description: 'EMA 20/50/200, MACD, RSI, ADX, ATR and volume ratio — composite confidence score.',
    metric: '65%+',
    metricLabel: 'Threshold',
    metricColor: '#BA7517',
    iconBg: 'rgba(29,158,117,0.15)',
    iconColor: '#1D9E75',
    Icon: TrendingUpIcon,
  },
  {
    title: 'Auto-Execute',
    description: 'Market order fires the instant a signal is detected. SL/TP auto-set via ATR × 1.5 / 2.5.',
    metric: 'Instant',
    metricLabel: 'Execution',
    metricColor: '#7F77DD',
    iconBg: 'rgba(127,119,221,0.15)',
    iconColor: '#7F77DD',
    Icon: ZapIcon,
  },
  {
    title: 'Regime Detection',
    description: 'Trending, Range-Bound or Low Participation — right strategy for every market condition.',
    metric: '3',
    metricLabel: 'Regime types',
    metricColor: '#BA7517',
    iconBg: 'rgba(186,117,23,0.15)',
    iconColor: '#BA7517',
    Icon: ClockIcon,
  },
  {
    title: 'AI Advisor',
    description: 'Query any signal, build strategies. GPT-4o powered personal analysis for premium users.',
    metric: 'GPT-4o',
    metricLabel: 'AI engine',
    metricColor: '#1D9E75',
    iconBg: 'rgba(29,158,117,0.15)',
    iconColor: '#1D9E75',
    Icon: MessageSquareIcon,
  },
  {
    title: 'Backtest Engine',
    description: 'Test strategies against historical data before going live. Optimize with parameter scanning.',
    metric: 'Historical',
    metricLabel: 'Backtest',
    metricColor: '#D85A30',
    iconBg: 'rgba(216,90,48,0.15)',
    iconColor: '#D85A30',
    Icon: BarChart2Icon,
  },
  {
    title: 'Market Intel',
    description: 'Fear & Greed, whale alerts, ETF flows and on-chain metrics — follow the big money.',
    metric: 'Live',
    metricLabel: 'Intelligence',
    metricColor: '#7F77DD',
    iconBg: 'rgba(127,119,221,0.15)',
    iconColor: '#7F77DD',
    Icon: ActivityIcon,
  },
];

const steps: StepItem[] = [
  {
    number: '01',
    color: '#1D9E75',
    title: 'Create an Account',
    description: 'Sign up with email, your 7-day free trial starts immediately. No credit card required.',
  },
  {
    number: '02',
    color: '#7F77DD',
    title: 'Connect Binance API (Optional)',
    description: 'No API needed for signals only. Connect your API key for auto-execution — trade permission only, never withdrawal.',
  },
  {
    number: '03',
    color: '#BA7517',
    title: 'Track Signals or Enable Automation',
    description: 'Monitor AI signals across 180+ pairs. Activate the bot — it fires orders automatically when signals trigger.',
  },
];

const faqs = [
  {
    question: 'How is the confidence score calculated?',
    answer: 'EMA alignment, RSI, MACD, volume ratio and swing point analysis — each weighted in a composite score. Above 65% is Directional Edge, below is Limited Edge or No Edge.',
  },
  {
    question: 'Is my API key secure?',
    answer: 'Your API key is encrypted with AES-256-GCM — never stored as plaintext. Only trade permission is requested, withdrawal access is never asked. Add IP restriction on Binance for extra security.',
  },
  {
    question: 'Which pairs are supported?',
    answer: '180+ USDT pairs — BTC, ETH, SOL, BNB, XRP and more. 1-hour, 4-hour and daily timeframes.',
  },
  {
    question: 'Is there a signal guarantee?',
    answer: 'No platform can guarantee 100% success — neither can Cortexa. Our goal is to tilt probability in your favor. Low-confidence signals are flagged as No Edge to protect you from unnecessary risk.',
  },
  {
    question: 'How quickly can I cancel?',
    answer: 'One click, instant. Access continues until the end of your billing period, no further charges.',
  },
];

const sectionPadding: CSSProperties = {
  padding: '80px 48px',
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  color: ACCENT,
  fontFamily: MONO,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: 12,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 44,
  fontWeight: 800,
  letterSpacing: '-1px',
  marginBottom: 12,
  color: '#ffffff',
  fontFamily: SANS,
};

const sectionSubStyle: CSSProperties = {
  fontSize: 16,
  color: 'rgba(255,255,255,0.45)',
  maxWidth: 480,
  margin: '0 auto 48px',
  lineHeight: 1.6,
};

function NavButton({ label, onClick, filled = false }: { label: string; onClick: () => void; filled?: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: filled ? 'none' : '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '7px 16px',
        background: filled ? (hovered ? ACCENT_DARK : ACCENT) : 'transparent',
        color: filled ? '#ffffff' : 'rgba(255,255,255,0.7)',
        fontSize: 13,
        fontWeight: filled ? 600 : 500,
        cursor: 'pointer',
        fontFamily: SANS,
        transition: 'all 0.18s ease',
      }}
    >
      {label}
    </button>
  );
}

function FeatureCard({ item }: { item: FeatureItem }) {
  const [hovered, setHovered] = useState(false);
  const Icon = item.Icon;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(29,158,117,0.04)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${hovered ? 'rgba(29,158,117,0.3)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 14,
        padding: 24,
        transition: 'all 0.18s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: item.iconBg,
            color: item.iconColor,
            flexShrink: 0,
          }}
        >
          <Icon color={item.iconColor} />
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 500, fontFamily: MONO, color: item.metricColor }}>{item.metric}</div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: MONO,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginTop: 4,
            }}
          >
            {item.metricLabel}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#ffffff', fontFamily: SANS }}>{item.title}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{item.description}</div>
    </div>
  );
}

function PricingCard({ plan }: { plan: PlanItem }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: plan.featured ? `2px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: 24,
      }}
    >
      {plan.featured ? (
        <div
          style={{
            display: 'inline-block',
            marginBottom: 8,
            padding: '3px 10px',
            borderRadius: 6,
            background: 'rgba(29,158,117,0.1)',
            color: ACCENT,
            fontSize: 11,
            fontFamily: MONO,
          }}
        >
          Most popular
        </div>
      ) : null}

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#ffffff', fontFamily: SANS }}>{plan.name}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 2, color: '#ffffff', fontFamily: SANS }}>{plan.price}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 16, fontFamily: MONO }}>{plan.period}</div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
        {plan.items.map((entry) => (
          <li
            key={entry}
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.5)',
              padding: '5px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <span style={{ color: ACCENT, fontWeight: 600 }}>+</span>
            <span>{entry}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={plan.action}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          padding: 10,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: SANS,
          border: plan.featured ? 'none' : '1px solid rgba(255,255,255,0.15)',
          background: plan.featured ? (hovered ? ACCENT_DARK : ACCENT) : 'transparent',
          color: '#ffffff',
          transition: 'all 0.18s ease',
        }}
      >
        {plan.buttonLabel}
      </button>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [ctaHovered, setCtaHovered] = useState(false);
  const [bottomHovered, setBottomHovered] = useState(false);

  const tickerItems = useMemo(() => [...tickerBase, ...tickerBase], []);

  const plans: PlanItem[] = [
    {
      name: 'Starter',
      price: 'Free',
      period: '7-day trial',
      items: ['Limited signals', '3 pairs', 'Daily timeframe'],
      buttonLabel: 'Get Started',
      action: () => navigate('/register'),
    },
    {
      name: 'Premium',
      price: '$29',
      period: '/ mo · 20% off yearly',
      featured: true,
      items: ['180+ pairs · all timeframes', 'AI advisor chat', 'Auto-execution', 'Backtest engine', 'Market intelligence'],
      buttonLabel: 'Start 7-Day Free Trial',
      action: () => navigate('/register?plan=premium'),
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'Volume-based',
      items: ['Unlimited signals · API access', 'Custom integration', 'Priority support'],
      buttonLabel: 'Contact Us →',
      action: () => {
        window.location.href = 'mailto:hello@cortexaai.net';
      },
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#ffffff', fontFamily: SANS }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `,
        }}
      />

      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(10,10,10,0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 48px',
        }}
      >
        <div>
          <span
            style={{
              color: '#ffffff',
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: '0.28em',
              fontFamily: SANS,
            }}
          >
            CORTEXA
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NavButton label="Stats" onClick={() => navigate('/stats')} />
          <NavButton
            label="How it works"
            onClick={() => {
              const element = document.getElementById('how');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          />
          <NavButton label="Launch App →" onClick={() => navigate('/login')} filled />
        </div>
      </nav>

      <section
        style={{
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 0',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            gap: 40,
            animation: 'marquee 25s linear infinite',
            minWidth: 'max-content',
          }}
        >
          {tickerItems.map((item, index) => (
            <div
              key={`${item}-${index}`}
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                fontFamily: MONO,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, flexShrink: 0 }} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ textAlign: 'center', padding: '80px 48px 64px' }}>
        <div
          style={{
            display: 'inline-flex',
            background: 'rgba(29,158,117,0.1)',
            border: '1px solid rgba(29,158,117,0.3)',
            borderRadius: 20,
            padding: '6px 16px',
            fontSize: 11,
            color: ACCENT,
            fontFamily: MONO,
            letterSpacing: '0.1em',
            marginBottom: 32,
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT }} />
          AI SIGNAL ENGINE — 180+ PAIRS
        </div>

        <h1 style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2, marginBottom: 20, fontFamily: SANS }}>
          <span style={{ color: '#ffffff' }}>Find Your Edge</span>
          <span style={{ color: ACCENT, display: 'block' }}>In Crypto.</span>
          <span style={{ color: '#ffffff', display: 'block' }}>Trade Instantly.</span>
        </h1>

        <p
          style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.5)',
            maxWidth: 500,
            margin: '0 auto 40px',
            lineHeight: 1.6,
          }}
        >
          AI-powered signals, market regime classification and auto-execution — all in one dark-mode crypto terminal.
        </p>

        <button
          type="button"
          onClick={() => navigate('/register')}
          onMouseEnter={() => setCtaHovered(true)}
          onMouseLeave={() => setCtaHovered(false)}
          style={{
            background: ctaHovered ? ACCENT_DARK : ACCENT,
            color: '#ffffff',
            border: 'none',
            borderRadius: 12,
            padding: '16px 36px',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.18s ease',
            fontFamily: SANS,
          }}
        >
          Start Free →
        </button>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: MONO, marginTop: 12, letterSpacing: '0.04em' }}>
          No credit card required — 7 days full access
        </div>
      </section>

      <section
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 0,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        {stats.map((item, index) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '40px 0',
              borderRight: index < stats.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
          >
            <div style={{ fontSize: 40, fontWeight: 800, color: ACCENT, fontFamily: MONO, marginBottom: 6 }}>{item.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: MONO, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {item.label}
            </div>
          </div>
        ))}
      </section>

      <section style={{ ...sectionPadding, textAlign: 'center' }}>
        <div style={eyebrowStyle}>Features</div>
        <h2 style={sectionTitleStyle}>Built for Speed & Accuracy</h2>
        <p style={sectionSubStyle}>Six indicator groups, regime classification and confidence scoring — behind every signal.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {features.map((feature) => (
            <FeatureCard key={feature.title} item={feature} />
          ))}
        </div>
      </section>

      <section id="how" style={{ ...sectionPadding, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <div style={eyebrowStyle}>How It Works</div>
        <h2 style={sectionTitleStyle}>Three Steps to Start</h2>

        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
          {steps.map((step) => (
            <div
              key={step.number}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14,
                padding: '28px 32px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 24,
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 500, fontFamily: MONO, minWidth: 48, color: step.color }}>{step.number}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#ffffff', fontFamily: SANS }}>{step.title}</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...sectionPadding, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {plans.map((plan) => (
            <PricingCard key={plan.name} plan={plan} />
          ))}
        </div>
      </section>

      <section style={{ ...sectionPadding, borderTop: '1px solid rgba(255,255,255,0.06)', maxWidth: 960, margin: '0 auto' }}>
        <div style={eyebrowStyle}>FAQ</div>
        <h2 style={sectionTitleStyle}>Frequently Asked Questions</h2>

        <div>
          {faqs.map((faq, index) => (
            <div key={faq.question} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 600,
                  padding: '20px 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontFamily: SANS,
                }}
              >
                <span>{faq.question}</span>
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>{openFaq === index ? '−' : '+'}</span>
              </button>

              {openFaq === index ? (
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, paddingBottom: 20 }}>{faq.answer}</div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '80px 48px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <h2 style={{ fontSize: 44, fontWeight: 800, marginBottom: 16, color: '#ffffff', fontFamily: SANS }}>Still on the fence?</h2>
        <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 32, fontSize: 16 }}>Try all features free for 7 days. No card required.</p>
        <button
          type="button"
          onClick={() => navigate('/register')}
          onMouseEnter={() => setBottomHovered(true)}
          onMouseLeave={() => setBottomHovered(false)}
          style={{
            background: bottomHovered ? ACCENT_DARK : ACCENT,
            color: '#ffffff',
            border: 'none',
            borderRadius: 12,
            padding: '16px 36px',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.18s ease',
            fontFamily: SANS,
          }}
        >
          Start Free →
        </button>
      </section>

      <footer
        style={{
          padding: '24px 48px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontFamily: MONO }}>© 2025 Cortexa · cortexaai.net</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button type="button" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>
            Privacy
          </button>
          <button type="button" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>
            Terms
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = 'mailto:hello@cortexaai.net';
            }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}
          >
            Support
          </button>
        </div>
      </footer>
    </div>
  );
}
