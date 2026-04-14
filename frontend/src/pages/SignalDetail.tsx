import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { fetchSignalById, fetchSignalCandles } from '@/api';
import C from '@/styles/theme';
import type { IndicatorBias, Signal, SignalCandle } from '@/types/signal';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: value < 10 ? 4 : 2,
    maximumFractionDigits: value < 10 ? 4 : 2,
  }).format(value);

const computeEMA = (values: number[], period = 14) => {
  if (!values.length) return [];
  const multiplier = 2 / (period + 1);
  let ema = values[0];
  return values.map((value, index) => {
    if (index === 0) return value;
    ema = value * multiplier + ema * (1 - multiplier);
    return Number(ema.toFixed(4));
  });
};

const biasTone: Record<IndicatorBias, { color: string; bg: string; border: string; label: string }> = {
  bull: { color: '#86efac', bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.28)', label: 'Bull' },
  bear: { color: '#fda4af', bg: 'rgba(244,63,94,0.14)', border: 'rgba(244,63,94,0.28)', label: 'Bear' },
  neutral: { color: C.textSub, bg: 'rgba(255,255,255,0.05)', border: C.border, label: 'Neutral' },
};

const edgeTone = {
  long: { color: '#86efac', bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.28)' },
  short: { color: '#fda4af', bg: 'rgba(244,63,94,0.14)', border: 'rgba(244,63,94,0.28)' },
  limited: { color: '#fcd34d', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.28)' },
  none: { color: C.textSub, bg: 'rgba(255,255,255,0.05)', border: C.border },
} as const;

const regimeTone = {
  trending: { color: C.green, bg: C.greenMuted, border: 'rgba(29,158,117,0.3)', label: 'Trending' },
  range: { color: '#93c5fd', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.28)', label: 'Range' },
  low: { color: '#cbd5e1', bg: 'rgba(148,163,184,0.14)', border: 'rgba(148,163,184,0.24)', label: 'Low vol' },
} as const;

const timeAgo = (isoString: string) => {
  const value = new Date(isoString).getTime();
  if (!Number.isFinite(value)) return 'just now';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - value) / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
};

function ScoreBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <span style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Score</span>
        <span style={{ color: C.text, fontWeight: 700 }}>{clamped}%</span>
      </div>
      <div style={{ height: 9, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${clamped}%`, height: '100%', borderRadius: 999, background: C.green }} />
      </div>
    </div>
  );
}

export default function SignalDetail() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [signal, setSignal] = useState<Signal | null>(null);
  const [candles, setCandles] = useState<SignalCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const timeframe = searchParams.get('timeframe') || '1h';
        const nextSignal = await fetchSignalById(id, timeframe);
        const nextCandles = await fetchSignalCandles(nextSignal.symbol, nextSignal.timeframe);
        if (!cancelled) {
          setSignal(nextSignal);
          setCandles(nextCandles);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSignal(null);
          setCandles([]);
          setError(loadError instanceof Error ? loadError.message : 'Signal detail could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (id) void load();
    else {
      setLoading(false);
      setError('Signal id could not be found.');
    }
    return () => {
      cancelled = true;
    };
  }, [id, searchParams]);

  const chartConfig = useMemo(() => {
    const closes = candles.map((item) => item.close);
    const ema = computeEMA(closes, 14);
    const labels = candles.map((item) => new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(item.time)));

    return {
      data: {
        labels,
        datasets: [
          { label: 'Price', data: closes, borderColor: 'rgba(255,255,255,0.92)', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 2, pointRadius: 0, tension: 0.34, fill: true },
          { label: 'EMA 14', data: ema, borderColor: C.green, backgroundColor: C.green, borderWidth: 2, pointRadius: 0, tension: 0.3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: C.textMuted, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: C.textMuted } },
        },
        plugins: {
          legend: { labels: { color: C.text } },
          tooltip: { backgroundColor: 'rgba(10, 10, 10, 0.94)', borderColor: C.borderStrong, borderWidth: 1 },
        },
      } satisfies ChartOptions<'line'>,
    };
  }, [candles]);

  const breakdownRows = useMemo(() => {
    if (!signal) return [];
    return [
      { label: 'Trend', value: signal.scoreBreakdown.trend },
      { label: 'Momentum', value: signal.scoreBreakdown.momentum },
      { label: 'Regime', value: signal.scoreBreakdown.regime },
      { label: 'Volume', value: signal.scoreBreakdown.volume },
      { label: 'Risk', value: signal.scoreBreakdown.risk },
    ];
  }, [signal]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, padding: 24 }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gap: 16 }}>
          <div style={{ height: 96, borderRadius: 24, background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <div style={{ height: 420, borderRadius: 24, background: 'rgba(255,255,255,0.04)' }} />
            <div style={{ height: 420, borderRadius: 24, background: 'rgba(255,255,255,0.04)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: C.sans, padding: 24 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', borderRadius: 24, border: `1px solid ${C.border}`, background: C.surface, padding: 24, color: C.textSub }}>
          {error ?? 'Signal could not be found.'}
        </div>
      </div>
    );
  }

  const edge = edgeTone[signal.edge];
  const regime = regimeTone[signal.regime];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: C.sans, padding: 24 }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gap: 24 }}>
        <section style={{ borderRadius: 28, border: `1px solid ${C.border}`, background: C.surface, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <button type="button" onClick={() => navigate('/signals')} style={{ borderRadius: 999, border: `1px solid ${C.borderStrong}`, background: 'transparent', color: C.text, padding: '10px 14px', cursor: 'pointer', marginBottom: 16 }}>
                Back to list
              </button>
              <div style={{ color: C.green, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Signal detail</div>
              <h1 style={{ margin: '0 0 12px', fontSize: 42, lineHeight: 1.02, letterSpacing: '-0.04em' }}>{signal.pair} setup breakdown</h1>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ borderRadius: 999, border: `1px solid ${edge.border}`, background: edge.bg, color: edge.color, padding: '7px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{signal.edge}</span>
                <span style={{ borderRadius: 999, border: `1px solid ${regime.border}`, background: regime.bg, color: regime.color, padding: '7px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{regime.label}</span>
                <span style={{ borderRadius: 999, border: `1px solid ${C.border}`, padding: '7px 12px', color: C.textMuted, fontFamily: C.mono, fontSize: 11 }}>{signal.timeframe}</span>
                <span style={{ color: C.textSub, fontSize: 13 }}>{timeAgo(signal.updatedAt)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => navigate('/portfolio')} style={{ borderRadius: 12, border: `1px solid ${C.borderStrong}`, background: 'transparent', color: C.text, padding: '12px 16px', cursor: 'pointer' }}>
                Connect portfolio
              </button>
              <button type="button" onClick={() => navigate('/assistant')} style={{ borderRadius: 12, border: 'none', background: C.green, color: C.text, padding: '12px 16px', cursor: 'pointer', fontWeight: 700 }}>
                Ask AI advisor
              </button>
              <button type="button" onClick={() => navigate('/analytics')} style={{ borderRadius: 12, border: `1px solid ${C.borderStrong}`, background: 'transparent', color: C.text, padding: '12px 16px', cursor: 'pointer' }}>
                Open backtest
              </button>
            </div>
          </div>
        </section>

        {error ? <div style={{ borderRadius: 18, border: '1px solid rgba(244,63,94,0.28)', background: 'rgba(244,63,94,0.12)', color: '#fecdd3', padding: '14px 16px', fontSize: 14 }}>{error}</div> : null}

        <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {[
            { label: 'Price', value: `$${formatPrice(signal.price)}`, hint: 'Reference spot price' },
            { label: 'Edge', value: signal.edge.toUpperCase(), hint: 'Directional opportunity state' },
            { label: 'Total score', value: `${signal.score}%`, hint: 'Composite setup score' },
            { label: 'Confidence', value: `${signal.confidence ?? signal.score}%`, hint: 'Model confidence level' },
          ].map((item) => (
            <div key={item.label} style={{ borderRadius: 22, border: `1px solid ${C.border}`, background: C.surface, padding: 20 }}>
              <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{item.label}</div>
              <div style={{ fontSize: 34, fontWeight: 800, margin: '10px 0 8px' }}>{item.value}</div>
              <div style={{ color: C.textSub, fontSize: 13, lineHeight: 1.6 }}>{item.hint}</div>
            </div>
          ))}
        </section>

        <section style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 420px)' }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ borderRadius: 24, border: `1px solid ${C.border}`, background: C.surface, padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Price + EMA view</div>
                  <div style={{ color: C.textSub, fontSize: 14 }}>Recent candles with EMA 14 overlay from Chart.js.</div>
                </div>
                <div style={{ minWidth: 220, flex: 1, maxWidth: 320 }}>
                  <ScoreBar score={signal.score} />
                </div>
              </div>
              <div style={{ height: 360 }}>
                <Line data={chartConfig.data} options={chartConfig.options} />
              </div>
            </div>

            <div style={{ borderRadius: 24, border: `1px solid ${C.border}`, background: C.surface, padding: 22 }}>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Technical indicators</div>
              <div style={{ color: C.textSub, fontSize: 14, marginBottom: 18 }}>Quick bias read across the current indicator snapshot.</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {signal.indicators.map((indicator) => {
                  const tone = biasTone[indicator.bias];
                  return (
                    <div key={indicator.name} style={{ borderRadius: 18, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)', padding: 16, display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1.2fr) minmax(120px, 0.8fr) auto', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{indicator.name}</div>
                        {indicator.note ? <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>{indicator.note}</div> : null}
                      </div>
                      <div style={{ color: C.text, fontWeight: 600 }}>{indicator.value}</div>
                      <span style={{ borderRadius: 999, border: `1px solid ${tone.border}`, background: tone.bg, color: tone.color, padding: '7px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{tone.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ borderRadius: 24, border: `1px solid ${C.border}`, background: C.surface, padding: 22 }}>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Support / resistance</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {signal.supportResistance.map((level) => (
                  <div key={level.label} style={{ borderRadius: 18, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)', padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{level.label}</span>
                      <span style={{ color: level.type === 'support' ? '#86efac' : '#fda4af', fontFamily: C.mono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{level.type}</span>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, marginTop: 10 }}>${formatPrice(level.value)}</div>
                    {typeof level.distancePct === 'number' ? <div style={{ color: C.textSub, fontSize: 12, marginTop: 6 }}>{level.distancePct > 0 ? '+' : ''}{level.distancePct}% distance</div> : null}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderRadius: 24, border: `1px solid ${C.border}`, background: C.surface, padding: 22 }}>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Score breakdown</div>
              <div style={{ display: 'grid', gap: 14 }}>
                {breakdownRows.map((row) => (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, fontSize: 14 }}>
                      <span style={{ color: C.textSub }}>{row.label}</span>
                      <span style={{ color: C.text, fontWeight: 700 }}>{row.value}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(0, Math.min(100, row.value))}%`, height: '100%', borderRadius: 999, background: C.green }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderRadius: 24, border: `1px solid ${C.border}`, background: C.surface, padding: 22 }}>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Narrative summary</div>
              <div style={{ color: C.text, fontSize: 14, lineHeight: 1.8 }}>{signal.nlpSummary}</div>
              <div style={{ color: C.textSub, fontSize: 13, lineHeight: 1.7, marginTop: 14 }}>{signal.summary}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
