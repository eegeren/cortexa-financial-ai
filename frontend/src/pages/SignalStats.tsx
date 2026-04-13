import { useEffect, useMemo, useState } from 'react';
import {
  BarElement,
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
import { Bar, Line } from 'react-chartjs-2';
import Card from '@/components/Card';
import PageHeader from '@/components/PageHeader';
import Spinner from '@/components/Spinner';
import {
  fetchRecentOutcomes,
  fetchStatsByConfidence,
  fetchStatsByPair,
  fetchStatsByTimeframe,
  fetchStatsOverview,
  type ConfidencePerformanceRow,
  type PairPerformanceRow,
  type RecentOutcomeRow,
  type StatsOverview,
  type TimeframePerformanceRow,
} from '@/services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const periods = [
  { label: '7 gün', value: '7d' },
  { label: '30 gün', value: '30d' },
  { label: 'Tüm zamanlar', value: 'all' },
] as const;

const toneClass = (value: number) => (value >= 0 ? 'text-emerald-200' : 'text-rose-200');
const formatPair = (pair: string) => pair.replace(/USDT$/i, '/USDT');
const formatMoney = (value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;

const SignalStatsPage = () => {
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [pairRows, setPairRows] = useState<PairPerformanceRow[]>([]);
  const [timeframeRows, setTimeframeRows] = useState<TimeframePerformanceRow[]>([]);
  const [confidenceRows, setConfidenceRows] = useState<ConfidencePerformanceRow[]>([]);
  const [recentRows, setRecentRows] = useState<RecentOutcomeRow[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchStatsOverview(period),
      fetchStatsByPair(),
      fetchStatsByTimeframe(),
      fetchStatsByConfidence(),
      fetchRecentOutcomes(20),
    ])
      .then(([overviewData, pairs, timeframes, confidence, recent]) => {
        if (!active) return;
        setOverview(overviewData);
        setPairRows(pairs);
        setTimeframeRows(timeframes);
        setConfidenceRows(confidence);
        setRecentRows(recent);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [period]);

  const trendChart = useMemo(() => {
    const labels = overview?.trend?.map((item) => item.day) ?? [];
    const values = overview?.trend?.map((item) => item.win_rate) ?? [];
    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Win rate',
            data: values,
            borderColor: '#34d399',
            backgroundColor: 'rgba(52,211,153,0.12)',
            tension: 0.35,
            fill: true,
          },
          {
            label: '50% referans',
            data: labels.map(() => 50),
            borderColor: 'rgba(148,163,184,0.55)',
            borderDash: [6, 6],
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: {
          y: { min: 0, max: 100, ticks: { callback: (value: string | number) => `%${value}` } },
        },
      } satisfies ChartOptions<'line'>,
    };
  }, [overview]);

  const confidenceChart = useMemo(() => ({
    data: {
      labels: confidenceRows.map((item) => item.bucket),
      datasets: [
        {
          label: 'Win rate',
          data: confidenceRows.map((item) => item.win_rate),
          backgroundColor: ['rgba(56,189,248,0.55)', 'rgba(16,185,129,0.6)', 'rgba(234,179,8,0.65)'],
          borderRadius: 12,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: (value: string | number) => `%${value}` } },
      },
    } satisfies ChartOptions<'bar'>,
  }), [confidenceRows]);

  if (loading) {
    return <Spinner />;
  }

  if (!overview) {
    return <div className="text-slate-300">Stats yüklenemedi.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Signal Stats" description="Sinyallerin gerçek sonucu, win rate dağılımı ve güven skorunun doğruluğa etkisi burada." />

      <div className="flex flex-wrap gap-2">
        {periods.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setPeriod(item.value)}
            className={`rounded-full border px-4 py-2 text-sm transition ${period === item.value ? 'border-cyan-400/40 bg-cyan-500/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!overview.data_sufficient && (
        <Card className="border-amber-400/20 bg-amber-500/10 text-amber-100">
          Minimum 50 ölçülmüş sinyal olmadan win rate yorumu yanıltıcı olabilir. Veri hâlâ birikiyor.
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Genel win rate', value: `%${overview.win_rate.toFixed(1)}`, tone: overview.win_rate >= 50 ? 'text-emerald-200' : 'text-rose-200' },
          { label: 'Toplam ölçülen sinyal', value: overview.total_signals.toLocaleString(), tone: 'text-white' },
          { label: 'Ortalama kazanç', value: `${overview.avg_win_pct >= 0 ? '+' : ''}${overview.avg_win_pct.toFixed(2)}%`, tone: toneClass(overview.avg_win_pct) },
          { label: 'Ortalama kayıp', value: `${overview.avg_loss_pct.toFixed(2)}%`, tone: toneClass(overview.avg_loss_pct) },
        ].map((item) => (
          <Card key={item.label}>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">{item.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${item.tone}`}>{item.value}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Win rate trend</p>
          <div className="mt-4"><Line data={trendChart.data} options={trendChart.options} /></div>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Güven skoru vs win rate</p>
          <div className="mt-4"><Bar data={confidenceChart.data} options={confidenceChart.options} /></div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Parite performansı</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Parite</th>
                  <th className="px-4 py-3">Sinyal</th>
                  <th className="px-4 py-3">Win</th>
                  <th className="px-4 py-3">Loss</th>
                  <th className="px-4 py-3">Win Rate</th>
                  <th className="px-4 py-3">Ort. Kazanç</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {pairRows.map((row) => (
                  <tr key={row.pair}>
                    <td className="px-4 py-3 font-medium text-white">{formatPair(row.pair)}</td>
                    <td className="px-4 py-3">{row.total_signals}</td>
                    <td className="px-4 py-3 text-emerald-200">{row.win_count}</td>
                    <td className="px-4 py-3 text-rose-200">{row.loss_count}</td>
                    <td className={`px-4 py-3 font-semibold ${row.win_rate > 60 ? 'text-emerald-200' : row.win_rate < 40 ? 'text-rose-200' : 'text-slate-100'}`}>%{row.win_rate.toFixed(1)}</td>
                    <td className="px-4 py-3">{row.avg_win_pct >= 0 ? '+' : ''}{row.avg_win_pct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Timeframe karşılaştırması</p>
          <div className="mt-4 space-y-3">
            {timeframeRows.map((row) => (
              <div key={row.timeframe} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{row.timeframe}</p>
                  <span className={row.win_rate >= 50 ? 'text-emerald-200' : 'text-rose-200'}>%{row.win_rate.toFixed(1)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{row.total_signals} sinyal · {row.win_count} win · {row.loss_count} loss</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Son sonuçlar</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Zaman</th>
                <th className="px-4 py-3">Parite</th>
                <th className="px-4 py-3">Edge</th>
                <th className="px-4 py-3">Güven</th>
                <th className="px-4 py-3">Giriş</th>
                <th className="px-4 py-3">Çıkış</th>
                <th className="px-4 py-3">Değişim</th>
                <th className="px-4 py-3">Sonuç</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {recentRows.map((row) => (
                <tr key={`${row.pair}-${row.created_at}-${row.checked_at}`}>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-white">{formatPair(row.pair)}</td>
                  <td className="px-4 py-3 uppercase">{row.edge}</td>
                  <td className="px-4 py-3">%{row.confidence_score}</td>
                  <td className="px-4 py-3">{formatMoney(row.entry_price)}</td>
                  <td className="px-4 py-3">{row.check_price ? formatMoney(row.check_price) : '—'}</td>
                  <td className={`px-4 py-3 ${row.price_change_pct >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{row.price_change_pct >= 0 ? '+' : ''}{row.price_change_pct.toFixed(2)}%</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${row.outcome === 'win' ? 'bg-emerald-500/10 text-emerald-100' : row.outcome === 'loss' ? 'bg-rose-500/10 text-rose-100' : row.outcome === 'breakeven' ? 'bg-slate-500/10 text-slate-200' : 'bg-amber-500/10 text-amber-100'}`}>
                      {row.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default SignalStatsPage;
