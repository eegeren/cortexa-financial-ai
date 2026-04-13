import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/Card';
import { fetchRecentOutcomes, fetchStatsOverview, type RecentOutcomeRow, type StatsOverview } from '@/services/api';

const tone = (value: number) => (value >= 0 ? 'text-emerald-200' : 'text-rose-200');
const icon = (outcome: string) => {
  if (outcome === 'win') return '↗';
  if (outcome === 'loss') return '↘';
  if (outcome === 'breakeven') return '•';
  return '…';
};

const StatsWidget = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [recent, setRecent] = useState<RecentOutcomeRow[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchStatsOverview('30d'), fetchRecentOutcomes(10)])
      .then(([overviewData, recentData]) => {
        if (!active) return;
        setOverview(overviewData);
        setRecent(recentData);
      })
      .catch(() => {
        if (!active) return;
        setOverview(null);
        setRecent([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const shouldShowPlaceholder = !overview || !overview.data_sufficient || overview.total_signals < 50;

  return (
    <Card className="rounded-[2rem] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(6,12,18,0.96),rgba(13,20,32,0.92))] p-6 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-muted)]">Signal validation</p>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Gerçek sonuçlara dayalı performans</h2>
          <p className="mt-2 text-sm text-slate-300">Son 30 gün, ölçülmüş sinyaller üzerinden canlı doğrulama.</p>
        </div>
        <button type="button" onClick={() => navigate('/signals')} className="btn btn-primary">
          Canlı sinyallere eriş →
        </button>
      </div>

      {loading || shouldShowPlaceholder ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 px-5 py-6 text-sm text-slate-300">
          Veri biriktiriliyor. İlk 2-4 hafta içinde daha anlamlı win rate ve outcome istatistikleri burada görünecek.
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Win Rate</p>
              <p className={`mt-3 text-4xl font-semibold ${overview.win_rate >= 50 ? 'text-emerald-200' : 'text-rose-200'}`}>%{overview.win_rate.toFixed(0)}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Ölçülen Sinyal</p>
              <p className="mt-3 text-4xl font-semibold text-white">{overview.total_signals.toLocaleString()}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Ort. Kazanç</p>
              <p className={`mt-3 text-4xl font-semibold ${tone(overview.avg_win_pct)}`}>{overview.avg_win_pct >= 0 ? '+' : ''}{overview.avg_win_pct.toFixed(1)}%</p>
            </div>
          </div>

          <p className="mt-4 text-xs text-[color:var(--text-muted)]">Son 30 gün · Gerçek veriye dayalı</p>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="space-y-2">
              {recent.map((item) => (
                <div key={`${item.pair}-${item.created_at}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 px-3 py-2 text-sm text-slate-200">
                  <div className="flex items-center gap-3">
                    <span className={item.outcome === 'win' ? 'text-emerald-300' : item.outcome === 'loss' ? 'text-rose-300' : 'text-slate-400'}>{icon(item.outcome)}</span>
                    <span>{item.pair.replace(/USDT$/i, '/USDT')}</span>
                  </div>
                  <span className={tone(item.price_change_pct)}>{item.price_change_pct >= 0 ? '+' : ''}{item.price_change_pct.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default StatsWidget;
