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
import { EdgeBadge, RegimeLabel, ScoreBar, timeAgo } from '@/components/signals/SignalBadges';
import PageHeader from '@/components/PageHeader';
import type { IndicatorBias, Signal, SignalCandle } from '@/types/signal';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: value < 10 ? 4 : 2,
    maximumFractionDigits: value < 10 ? 4 : 2,
  }).format(value);

const computeEMA = (values: number[], period = 14) => {
  if (!values.length) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  let ema = values[0];

  return values.map((value, index) => {
    if (index === 0) {
      return value;
    }
    ema = value * multiplier + ema * (1 - multiplier);
    return Number(ema.toFixed(4));
  });
};

const biasClasses: Record<IndicatorBias, string> = {
  bull: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  bear: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  neutral: 'border-white/10 bg-white/5 text-[color:var(--text-muted)]',
};

const biasLabels: Record<IndicatorBias, string> = {
  bull: 'Bull',
  bear: 'Bear',
  neutral: 'Nötr',
};

const SignalDetail = () => {
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
          setError(loadError instanceof Error ? loadError.message : 'Canlı signal detayı alınamadı.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (id) {
      void load();
    } else {
      setLoading(false);
      setError('Signal id bulunamadı.');
    }

    return () => {
      cancelled = true;
    };
  }, [id, searchParams]);

  const primaryColor = useMemo(() => {
    if (typeof window === 'undefined') {
      return '#0ea5a5';
    }
    return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#0ea5a5';
  }, []);

  const mutedColor = useMemo(() => {
    if (typeof window === 'undefined') {
      return '#94a3b8';
    }
    return getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#94a3b8';
  }, []);

  const chartConfig = useMemo(() => {
    const closes = candles.map((item) => item.close);
    const ema = computeEMA(closes, 14);
    const labels = candles.map((item) =>
      new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(item.time))
    );

    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Fiyat',
            data: closes,
            borderColor: 'rgba(255,255,255,0.9)',
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.34,
            fill: true,
          },
          {
            label: 'EMA 14',
            data: ema,
            borderColor: primaryColor,
            backgroundColor: primaryColor,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: mutedColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: mutedColor },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: '#ffffff',
            },
          },
          tooltip: {
            backgroundColor: 'rgba(10, 15, 24, 0.92)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
          },
        },
      } satisfies ChartOptions<'line'>,
    };
  }, [candles, mutedColor, primaryColor]);

  const breakdownRows = useMemo(() => {
    if (!signal) {
      return [];
    }

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
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-3xl bg-white/5" />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="h-[420px] animate-pulse rounded-3xl bg-white/5" />
          <div className="h-[420px] animate-pulse rounded-3xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="rounded-3xl border border-white/10 p-6 text-sm text-[color:var(--text-muted)]" style={{ backgroundColor: 'var(--surface)' }}>
        {error ?? 'Signal bulunamadı.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${signal.pair} Signal Detail`}
        description="Teknik yapı, EMA grafiği, destek-direnç ve güven skoru bileşenleri tek ekranda."
        actions={
          <button type="button" onClick={() => navigate('/signals')} className="btn btn-ghost">
            Listeye dön
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <EdgeBadge edge={signal.edge} />
          <RegimeLabel regime={signal.regime} />
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
            {signal.timeframe}
          </span>
          <span className="text-xs text-[color:var(--text-muted)]">{timeAgo(signal.updatedAt)}</span>
        </div>
      </PageHeader>

      {error && (
        <div className="rounded-2xl border border-rose-500/20 px-4 py-3 text-sm text-rose-200" style={{ backgroundColor: 'rgba(244, 63, 94, 0.08)' }}>
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Fiyat', value: `$${formatPrice(signal.price)}`, hint: 'Anlık referans fiyatı' },
          { label: 'Edge', value: signal.edge.toUpperCase(), hint: 'Yönsel fırsat etiketi' },
          { label: 'Toplam skor', value: `${signal.score}%`, hint: 'Kompozit güven skoru' },
          { label: 'Confidence', value: `${signal.confidence ?? signal.score}%`, hint: 'Model güven katsayısı' },
        ].map((item) => (
          <div key={item.label} className="rounded-3xl border border-white/10 p-5 shadow-elevation-soft" style={{ backgroundColor: 'var(--surface)' }}>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">{item.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_420px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 p-5 shadow-elevation-soft sm:p-6" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Fiyat + EMA grafiği</h2>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">Chart.js ile çizilen son mumlar ve EMA 14 overlay.</p>
              </div>
              <div className="min-w-[220px]">
                <ScoreBar score={signal.score} />
              </div>
            </div>
            <div className="mt-6 h-[340px]">
              <Line data={chartConfig.data} options={chartConfig.options} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 p-5 shadow-elevation-soft sm:p-6" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Teknik indikatörler</h2>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">Bull, bear ve nötr etiketleriyle hızlı okuma.</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-3xl border border-white/10">
              <div className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-4 border-b border-white/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)] sm:px-5">
                <span>İndikatör</span>
                <span>Değer</span>
                <span>Bias</span>
              </div>
              {signal.indicators.map((indicator) => (
                <div key={indicator.name} className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-4 border-b border-white/5 px-4 py-4 text-sm sm:px-5">
                  <div>
                    <p className="font-medium text-white">{indicator.name}</p>
                    {indicator.note && <p className="mt-1 text-xs text-[color:var(--text-muted)]">{indicator.note}</p>}
                  </div>
                  <div className="self-center text-white">{indicator.value}</div>
                  <div className="self-center">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${biasClasses[indicator.bias]}`}>
                      {biasLabels[indicator.bias]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 p-5 shadow-elevation-soft sm:p-6" style={{ backgroundColor: 'var(--surface)' }}>
            <h2 className="text-xl font-semibold text-white">Destek / direnç</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {signal.supportResistance.map((level) => (
                <div key={level.label} className="rounded-2xl border border-white/10 p-4" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white">{level.label}</span>
                    <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${level.type === 'support' ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {level.type}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-white">${formatPrice(level.value)}</p>
                  {typeof level.distancePct === 'number' && (
                    <p className="mt-2 text-xs text-[color:var(--text-muted)]">{level.distancePct > 0 ? '+' : ''}{level.distancePct}% uzaklık</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 p-5 shadow-elevation-soft sm:p-6" style={{ backgroundColor: 'var(--surface)' }}>
            <h2 className="text-xl font-semibold text-white">Güven skoru dökümü</h2>
            <div className="mt-5 space-y-4">
              {breakdownRows.map((row) => (
                <div key={row.label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-[color:var(--text-muted)]">{row.label}</span>
                    <span className="font-semibold text-white">{row.value}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, row.value))}%`, backgroundColor: 'var(--primary)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 p-5 shadow-elevation-soft sm:p-6" style={{ backgroundColor: 'var(--surface)' }}>
            <h2 className="text-xl font-semibold text-white">NLP özeti</h2>
            <p className="mt-4 text-sm leading-7 text-slate-200">{signal.nlpSummary}</p>
            <p className="mt-4 text-xs text-[color:var(--text-muted)]">{signal.summary}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <button type="button" onClick={() => navigate('/portfolio')} className="btn btn-ghost">
              Emre bağla
            </button>
            <button type="button" onClick={() => navigate('/assistant')} className="btn btn-primary">
              AI danışman
            </button>
            <button type="button" onClick={() => navigate('/analytics')} className="btn btn-ghost">
              Backtest
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SignalDetail;
