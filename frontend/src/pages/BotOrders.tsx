import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/Card';
import PageHeader from '@/components/PageHeader';
import Spinner from '@/components/Spinner';
import { useToast } from '@/components/ToastProvider';
import { cancelBotOrder, fetchBotOrders, type BotOrder } from '@/api';

const formatPair = (pair: string) => pair.replace(/USDT$/i, '/USDT');
const formatCurrency = (value?: number | null) => (value == null || Number.isNaN(value) ? '—' : `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`);
const formatQty = (value?: number | null) => (value == null || Number.isNaN(value) ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 6 }));

const approximatePnl = (order: BotOrder) => {
  if (order.status !== 'filled' || order.filled_price == null) return 0;
  const diff = order.side === 'short' ? order.entry_price - order.filled_price : order.filled_price - order.entry_price;
  return diff * order.quantity;
};

const statusTone = (status: string) => {
  switch (status) {
    case 'filled':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
    case 'cancelled':
      return 'border-slate-500/30 bg-slate-500/10 text-slate-200';
    case 'failed':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-100';
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  }
};

const BotOrdersPage = () => {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [pairQuery, setPairQuery] = useState('');
  const [orders, setOrders] = useState<BotOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchBotOrders(page, { status, pair: pairQuery, limit: 50 })
      .then((response) => {
        if (!active) return;
        setOrders(response.items);
        setTotal(response.total);
      })
      .catch((error) => {
        if (!active) return;
        pushToast(error instanceof Error ? error.message : 'Emirler yüklenemedi', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, pairQuery, pushToast, status]);

  const summary = useMemo(() => {
    const today = new Date().toDateString();
    const totalOrders = total;
    const filled = orders.filter((order) => order.status === 'filled').length;
    const failed = orders.filter((order) => order.status === 'failed').length;
    const todayPnl = orders
      .filter((order) => new Date(order.created_at).toDateString() === today)
      .reduce((acc, order) => acc + approximatePnl(order), 0);

    return { totalOrders, filled, failed, todayPnl };
  }, [orders, total]);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  const handleCancel = async (orderId: string) => {
    setWorkingId(orderId);
    try {
      await cancelBotOrder(orderId);
      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: 'cancelled', error_message: 'cancelled by user' } : order)));
      pushToast('Emir iptal edildi', 'success');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Emir iptal edilemedi', 'error');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bot Orders"
        description="Botun açtığı emirleri, hata durumlarını ve iptal akışını buradan takip edebilirsin."
        actions={<Link to="/bot/settings" className="btn btn-ghost">Bot ayarları</Link>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Toplam emir', value: summary.totalOrders, tone: 'text-white' },
          { label: 'Başarılı', value: summary.filled, tone: 'text-emerald-200' },
          { label: 'Başarısız', value: summary.failed, tone: 'text-rose-200' },
          { label: 'Bugünkü P&L (yaklaşık)', value: `${summary.todayPnl >= 0 ? '+' : ''}$${summary.todayPnl.toFixed(2)}`, tone: summary.todayPnl >= 0 ? 'text-emerald-200' : 'text-rose-200' },
        ].map((item) => (
          <Card key={item.label}>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">{item.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${item.tone}`}>{item.value}</p>
          </Card>
        ))}
      </section>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Tümü', value: '' },
              { label: 'Filled', value: 'filled' },
              { label: 'Cancelled', value: 'cancelled' },
              { label: 'Failed', value: 'failed' },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setPage(1);
                  setStatus(item.value);
                }}
                className={`rounded-full border px-4 py-2 text-sm transition ${status === item.value ? 'border-cyan-400/40 bg-cyan-500/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            className="input-base max-w-sm"
            value={pairQuery}
            onChange={(event) => {
              setPage(1);
              setPairQuery(event.target.value.toUpperCase());
            }}
            placeholder="Parite ara, örn. BTCUSDT"
          />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="p-8"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Zaman</th>
                  <th className="px-4 py-3">Parite + TF</th>
                  <th className="px-4 py-3">Yön</th>
                  <th className="px-4 py-3">Miktar</th>
                  <th className="px-4 py-3">Giriş</th>
                  <th className="px-4 py-3">SL</th>
                  <th className="px-4 py-3">TP</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {orders.map((order) => (
                  <tr key={order.id} className="align-top">
                    <td className="px-4 py-4 text-xs text-slate-400">{new Date(order.created_at).toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{formatPair(order.pair)}</div>
                      <div className="mt-1 text-xs text-slate-400">{order.timeframe || '1h'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${order.side === 'short' ? 'bg-rose-500/10 text-rose-100' : 'bg-emerald-500/10 text-emerald-100'}`}>
                        {order.side}
                      </span>
                    </td>
                    <td className="px-4 py-4">{formatQty(order.quantity)}</td>
                    <td className="px-4 py-4">{formatCurrency(order.entry_price)}</td>
                    <td className="px-4 py-4">{formatCurrency(order.sl_price)}</td>
                    <td className="px-4 py-4">{formatCurrency(order.tp_price)}</td>
                    <td className="px-4 py-4">
                      <div className="group relative inline-flex">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusTone(order.status)}`}>
                          {order.status}
                        </span>
                        {order.status === 'failed' && order.error_message && (
                          <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-64 rounded-xl border border-rose-500/20 bg-slate-950/95 px-3 py-2 text-xs text-rose-100 shadow-xl group-hover:block">
                            {order.error_message}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <Link to={`/signals/${encodeURIComponent(order.pair)}?timeframe=${order.timeframe || '1h'}`} className="text-sm text-cyan-300 transition hover:text-white">
                          Sinyali gör →
                        </Link>
                        <button
                          type="button"
                          disabled={order.status !== 'pending' || workingId === order.id}
                          onClick={() => handleCancel(order.id)}
                          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-white/20 hover:text-white"
                        >
                          {workingId === order.id ? 'İptal ediliyor...' : 'İptal Et'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!orders.length && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">
                      Henüz bot emri yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1} className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-50">
          Önceki
        </button>
        <p className="text-sm text-slate-400">Sayfa {page} / {totalPages}</p>
        <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages} className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-50">
          Sonraki
        </button>
      </div>
    </div>
  );
};

export default BotOrdersPage;
