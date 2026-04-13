import { useEffect, useRef, useState } from 'react';
import { fetchWhaleAlerts, type WhaleAlert } from '@/services/marketIntel';
import clsx from 'clsx';

const REFRESH_INTERVAL = 30_000;

const formatAmount = (usd: number): string => {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
};

const formatRelativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(Math.abs(diffMs) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const alertColor = (alert: WhaleAlert): string => {
  // To exchange (bearish signal) = green text to warn of selling pressure
  if (alert.to_type === 'exchange' && alert.from_type !== 'exchange') return 'text-rose-400';
  // From exchange (bullish signal) = green, whales withdrawing to accumulate
  if (alert.from_type === 'exchange' && alert.to_type !== 'exchange') return 'text-emerald-400';
  // Wallet to wallet
  return 'text-amber-400';
};

const alertIcon = (alert: WhaleAlert): string => {
  if (alert.to_type === 'exchange' && alert.from_type !== 'exchange') return '▼';
  if (alert.from_type === 'exchange' && alert.to_type !== 'exchange') return '▲';
  return '→';
};

interface TickerItemProps {
  alert: WhaleAlert;
}

const TickerItem = ({ alert }: TickerItemProps) => {
  const color = alertColor(alert);
  const icon = alertIcon(alert);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap pr-8 text-xs">
      <span className={clsx('font-bold', color)}>{icon}</span>
      <span className="font-semibold text-white">{formatAmount(alert.amount_usd)}</span>
      <span className="font-medium text-slate-300">{alert.symbol}</span>
      <span className="text-slate-500">{alert.from}</span>
      <span className="text-slate-600">→</span>
      <span className="text-slate-500">{alert.to}</span>
      <span className="text-slate-600">·</span>
      <span className="text-slate-600">{formatRelativeTime(alert.timestamp)}</span>
    </span>
  );
};

// Fallback static items shown while loading or on error
const FALLBACK_ALERTS: WhaleAlert[] = [
  {
    id: '1', timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
    amount: 1200, amount_usd: 82_000_000, symbol: 'BTC',
    from: 'Unknown Wallet', from_type: 'wallet',
    to: 'Binance', to_type: 'exchange',
  },
  {
    id: '2', timestamp: new Date(Date.now() - 12 * 60_000).toISOString(),
    amount: 15000, amount_usd: 41_000_000, symbol: 'ETH',
    from: 'Coinbase', from_type: 'exchange',
    to: 'Unknown Wallet', to_type: 'wallet',
  },
  {
    id: '3', timestamp: new Date(Date.now() - 22 * 60_000).toISOString(),
    amount: 5_000_000, amount_usd: 5_000_000, symbol: 'USDT',
    from: 'Unknown Wallet', from_type: 'wallet',
    to: 'Unknown Wallet', to_type: 'wallet',
  },
];

interface WhaleAlertsTickerProps {
  className?: string;
}

const WhaleAlertsTicker = ({ className }: WhaleAlertsTickerProps) => {
  const [alerts, setAlerts] = useState<WhaleAlert[]>(FALLBACK_ALERTS);
  const [loading, setLoading] = useState(true);
  const tickerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const posRef = useRef(0);

  const loadAlerts = async () => {
    try {
      const data = await fetchWhaleAlerts();
      if (data.alerts && data.alerts.length > 0) {
        setAlerts(data.alerts);
      }
    } catch {
      // keep fallback data visible on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
    const interval = setInterval(() => void loadAlerts(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // JS-based continuous scrolling animation
  useEffect(() => {
    const el = tickerRef.current;
    if (!el) return undefined;

    const speed = 0.5; // px per frame

    const animate = () => {
      posRef.current -= speed;
      const halfWidth = el.scrollWidth / 2;
      if (Math.abs(posRef.current) >= halfWidth) {
        posRef.current = 0;
      }
      el.style.transform = `translateX(${posRef.current}px)`;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [alerts]);

  const displayAlerts = [...alerts, ...alerts]; // duplicate for seamless loop

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/80 py-2',
        className
      )}
    >
      {/* Fade masks on sides */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-slate-950/90 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-slate-950/90 to-transparent" />

      {/* Label */}
      <span className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-400">
        Whale
      </span>

      <div className="overflow-hidden pl-20">
        {loading ? (
          <span className="text-xs text-slate-600">Loading whale activity...</span>
        ) : (
          <div ref={tickerRef} className="inline-flex will-change-transform">
            {displayAlerts.map((alert, i) => (
              <TickerItem key={`${alert.id}-${i}`} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhaleAlertsTicker;
