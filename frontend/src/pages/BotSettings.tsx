import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/Card';
import PageHeader from '@/components/PageHeader';
import Spinner from '@/components/Spinner';
import { useToast } from '@/components/ToastProvider';
import useOptimisticUpdate from '@/hooks/useOptimisticUpdate';
import {
  fetchBotOrders,
  fetchBotSettings,
  testBinanceConnection,
  toggleBot,
  updateBotSettings,
  type BotSettings,
} from '@/api';

const defaultSettings: BotSettings = {
  user_id: 0,
  active: false,
  pairs_whitelist: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
  all_pairs: false,
  min_confidence: 65,
  max_position_pct: 5,
  daily_loss_limit_pct: 3,
  trade_type: 'spot',
  has_binance_api_key: false,
};

const normalizePair = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '').replace('/', '');
const formatPair = (value: string) => {
  const normalized = normalizePair(value);
  if (!normalized) return value;
  return normalized.endsWith('USDT') ? `${normalized.replace(/USDT$/, '')}/USDT` : normalized;
};

const formatRelativeTime = (value?: string | null) => {
  if (!value) return 'henüz emir yok';
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'az önce';
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) return `${Math.max(diffMinutes, 1)} dk önce`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} saat önce`;
  return `${Math.floor(diffHours / 24)} gün önce`;
};

const BotSettingsPage = () => {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<BotSettings>(defaultSettings);
  const [draft, setDraft] = useState<BotSettings>(defaultSettings);
  const [pairInput, setPairInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; balance?: string; error?: string } | null>(null);
  const [lastOrderAt, setLastOrderAt] = useState<string | null>(null);
  const [baseline, setBaseline] = useState('');
  const optimisticActive = useOptimisticUpdate(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [settingsData, ordersData] = await Promise.all([
          fetchBotSettings(),
          fetchBotOrders(1, { limit: 1 }),
        ]);
        if (!mounted) return;
        setSettings(settingsData);
        setDraft(settingsData);
        optimisticActive.reset(settingsData.active);
        setLastOrderAt(ordersData.items[0]?.created_at ?? null);
        setBaseline(JSON.stringify(settingsData));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bot ayarları yüklenemedi';
        pushToast(message, 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [optimisticActive.reset, pushToast]);

  const statusText = optimisticActive.value
    ? lastOrderAt
      ? `Bot aktif · son emir ${formatRelativeTime(lastOrderAt)}`
      : 'Bot aktif · henüz emir yok'
    : 'Bot durduruldu';

  const hasConnectedApi = settings.has_binance_api_key || apiKey.trim().length > 0 || apiSecret.trim().length > 0;

  const isDirty = useMemo(() => {
    const comparable = JSON.stringify(draft);
    return comparable !== baseline || apiKey.trim().length > 0 || apiSecret.trim().length > 0;
  }, [apiKey, apiSecret, baseline, draft]);

  const updateDraft = <K extends keyof BotSettings>(key: K, value: BotSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddPair = () => {
    const normalized = normalizePair(pairInput);
    if (!normalized) return;
    if (draft.pairs_whitelist.includes(normalized)) {
      setPairInput('');
      return;
    }
    updateDraft('pairs_whitelist', [...draft.pairs_whitelist, normalized]);
    setPairInput('');
  };

  const handleRemovePair = (pair: string) => {
    updateDraft(
      'pairs_whitelist',
      draft.pairs_whitelist.filter((item) => item !== pair)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await updateBotSettings({
        ...draft,
        api_key: apiKey.trim() || undefined,
        api_secret: apiSecret.trim() || undefined,
      });
      setSettings(saved);
      setDraft(saved);
      optimisticActive.reset(saved.active);
      setApiKey('');
      setApiSecret('');
      setBaseline(JSON.stringify(saved));
      pushToast('Ayarlar kaydedildi', 'success');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Ayarlar kaydedilemedi', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    const next = !optimisticActive.value;
    optimisticActive.applyOptimistic(next);
    try {
      const response = await toggleBot(next);
      optimisticActive.confirm(response.active);
      setSettings((prev) => ({ ...prev, active: response.active }));
      setDraft((prev) => ({ ...prev, active: response.active }));
      pushToast(response.active ? 'Bot aktif edildi' : 'Bot durduruldu', 'success');
    } catch (error) {
      optimisticActive.rollback();
      pushToast(error instanceof Error ? error.message : 'Bot durumu güncellenemedi', 'error');
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      pushToast('Test için yeni API key ve secret girmen gerekiyor', 'warning');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testBinanceConnection(apiKey.trim(), apiSecret.trim());
      setTestResult(result);
      pushToast(result.success ? 'Bağlantı başarılı' : result.error ?? 'Bağlantı başarısız', result.success ? 'success' : 'error');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bağlantı testi başarısız';
      setTestResult({ success: false, error: message });
      pushToast(message, 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bot Settings"
        description="Otomatik emir botunu güvenli şekilde bağla, risk filtresini ayarla, izinli pariteleri seç."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/bot/orders" className="btn btn-ghost">
              Emir geçmişi
            </Link>
            <button type="button" disabled={!isDirty || saving} onClick={handleSave} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        }
      />

      <Card className="border-emerald-400/20 bg-emerald-500/8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-100">API key'iniz güvende</p>
            <ul className="mt-3 space-y-2 text-sm text-emerald-50/85">
              <li>AES-256-GCM şifreleme, plaintext asla saklanmaz</li>
              <li>Sadece işlem yetkisi, para çekme izni talep edilmez</li>
              <li>IP kısıtlaması ekleyerek ekstra güvence sağlayın</li>
            </ul>
          </div>
          <a
            href="https://www.binance.com/en/support/faq/how-to-create-api"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-emerald-200 transition hover:text-white"
          >
            Nasıl API key oluşturulur? →
          </a>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Bot durumu</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{optimisticActive.value ? 'Aktif' : 'Pasif'}</h2>
            <p className="mt-2 text-sm text-slate-300">{statusText}</p>
            {!settings.has_binance_api_key && !apiKey.trim() && !apiSecret.trim() && (
              <p className="mt-3 text-sm text-amber-200">API key bağlı değil. Önce bağlantı bilgilerini girip kaydetmen gerekiyor.</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={!hasConnectedApi}
            className={`relative inline-flex h-16 w-32 items-center rounded-full border px-2 transition ${
              optimisticActive.value ? 'border-emerald-400/40 bg-emerald-500/15' : 'border-white/10 bg-white/5'
            } ${!hasConnectedApi ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <span
              className={`absolute h-12 w-12 rounded-full bg-white shadow-lg transition-transform ${optimisticActive.value ? 'translate-x-16' : 'translate-x-0'}`}
            />
            <span className={`z-10 ml-2 text-xs font-semibold uppercase tracking-[0.22em] ${optimisticActive.value ? 'text-emerald-100' : 'text-slate-300'}`}>
              {optimisticActive.value ? 'aktif' : 'pasif'}
            </span>
          </button>
        </div>
      </Card>

      <Card>
        <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Binance API bağlantısı</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-slate-300">API Key</span>
            <div className="flex gap-2">
              <input
                className="input-base"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={settings.binance_api_key_masked || 'API key gir'}
              />
              <button type="button" className="btn btn-ghost shrink-0" onClick={() => setShowKey((prev) => !prev)}>
                {showKey ? 'Gizle' : 'Göster'}
              </button>
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">API Secret</span>
            <div className="flex gap-2">
              <input
                className="input-base"
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={(event) => setApiSecret(event.target.value)}
                placeholder="Secret yalnızca oluşturulurken görünür"
              />
              <button type="button" className="btn btn-ghost shrink-0" onClick={() => setShowSecret((prev) => !prev)}>
                {showSecret ? 'Gizle' : 'Göster'}
              </button>
            </div>
          </label>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <p>Binance → API Management → Create API → sadece “Enable Spot Trading” işaretleyin</p>
          <p>Secret yalnızca oluşturulurken görünür, kaydetmeyi unutmayın</p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" onClick={handleTestConnection} disabled={testing} className="btn btn-primary">
            {testing ? 'Test ediliyor...' : 'Bağlantıyı Test Et'}
          </button>
          {testResult?.success && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Bağlantı başarılı · Bakiye: ${testResult.balance} USDT
            </div>
          )}
          {testResult && !testResult.success && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {testResult.error}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <Card>
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Risk ayarları</p>
          <div className="mt-5 space-y-6">
            <label className="block space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>Min güven skoru</span>
                <strong className="text-white">{draft.min_confidence}% ve üzeri sinyaller</strong>
              </div>
              <input type="range" min={50} max={90} value={draft.min_confidence} onChange={(event) => updateDraft('min_confidence', Number(event.target.value))} className="w-full accent-cyan-400" />
            </label>

            <label className="block space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>Maks pozisyon büyüklüğü</span>
                <strong className="text-white">Bakiyenin %{draft.max_position_pct}'i</strong>
              </div>
              <input type="range" min={1} max={20} value={draft.max_position_pct} onChange={(event) => updateDraft('max_position_pct', Number(event.target.value))} className="w-full accent-cyan-400" />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-slate-300">Günlük kayıp limiti</span>
              <input
                className="input-base max-w-xs"
                type="number"
                min={1}
                step={0.5}
                value={draft.daily_loss_limit_pct}
                onChange={(event) => updateDraft('daily_loss_limit_pct', Number(event.target.value))}
              />
              <p className="text-xs text-[color:var(--text-muted)]">Limit aşılınca bot otomatik durur</p>
            </label>

            <div>
              <p className="text-sm text-slate-300">Trade tipi</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(['spot', 'futures'] as const).map((tradeType) => (
                  <button
                    key={tradeType}
                    type="button"
                    onClick={() => updateDraft('trade_type', tradeType)}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      draft.trade_type === tradeType ? 'border-cyan-400/40 bg-cyan-500/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'
                    }`}
                  >
                    <p className="font-semibold capitalize">{tradeType}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">{tradeType === 'spot' ? 'Daha sade ve kontrollü akış' : 'Kaldıraç ve short işlemler açılabilir'}</p>
                  </button>
                ))}
              </div>
              {draft.trade_type === 'futures' && (
                <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Futures yüksek risk içerir.
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">İzin verilen pariteler</p>
          <div className="mt-5 space-y-4">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={draft.all_pairs}
                onChange={(event) => updateDraft('all_pairs', event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-400"
              />
              Tüm pariteler
            </label>

            <div className="flex gap-2">
              <input
                className="input-base"
                value={pairInput}
                disabled={draft.all_pairs}
                onChange={(event) => setPairInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddPair();
                  }
                }}
                placeholder="BTC/USDT yaz + Enter"
              />
              <button type="button" disabled={draft.all_pairs} onClick={handleAddPair} className="btn btn-ghost">
                Ekle
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {draft.pairs_whitelist.map((pair) => (
                <span key={pair} className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100">
                  {formatPair(pair)}
                  {!draft.all_pairs && (
                    <button type="button" onClick={() => handleRemovePair(pair)} className="text-cyan-200 transition hover:text-white">
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default BotSettingsPage;
