import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Paywall from '@/components/Paywall';
import { sendChat, fetchMarketSummary, fetchNews, type ChatMessagePayload, type MarketSummaryItem } from '@/services/api';
import useSubscriptionAccess from '@/hooks/useSubscriptionAccess';

interface Message extends ChatMessagePayload {
  id: string;
  createdAt: number;
  isIntro?: boolean;
}

interface MarketContext {
  gainers: MarketSummaryItem[];
  losers: MarketSummaryItem[];
  major: MarketSummaryItem[];
  newsHeadlines: string[];
  fetchedAt: string;
}

const createMessage = (role: Message['role'], content: string, extras: Partial<Message> = {}): Message => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: Date.now(),
  ...extras,
});

const MAJOR_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

const fmt = (n?: number | null, decimals = 2) =>
  n == null ? '?' : n.toLocaleString(undefined, { maximumFractionDigits: decimals });

const buildSystemPrompt = (ctx: MarketContext | null): string => {
  const base = `You are Cortexa Assistant, a crypto trading co-pilot. Provide concise, data-driven insights using bullet points when useful. Highlight risk management and remind users to validate with their own research. Refuse anything unrelated to trading, markets, or product support.`;

  if (!ctx) return base;

  const gainersText = ctx.gainers
    .map((c) => `  • ${c.symbol}: +${fmt(c.price_change_percent)}% | $${fmt(c.last_price, c.last_price! >= 1 ? 2 : 6)}`)
    .join('\n');

  const losersText = ctx.losers
    .map((c) => `  • ${c.symbol}: ${fmt(c.price_change_percent)}% | $${fmt(c.last_price, c.last_price! >= 1 ? 2 : 6)}`)
    .join('\n');

  const majorText = ctx.major
    .map((c) => {
      const sign = (c.price_change_percent ?? 0) >= 0 ? '+' : '';
      return `  • ${c.symbol}: $${fmt(c.last_price, c.last_price! >= 1 ? 2 : 6)} (${sign}${fmt(c.price_change_percent)}%)`;
    })
    .join('\n');

  const newsText = ctx.newsHeadlines.length
    ? ctx.newsHeadlines.map((h) => `  • ${h}`).join('\n')
    : '  • No headlines available';

  return `${base}

--- LIVE MARKET DATA (as of ${ctx.fetchedAt}) ---

📈 Top Gainers (24h):
${gainersText}

📉 Top Losers (24h):
${losersText}

💰 Major Pairs (24h):
${majorText}

📰 Latest News Headlines:
${newsText}

When users ask about rising coins, trending markets, current prices, or market conditions — use the live data above. Always note the data timestamp. Do not fabricate prices or percentages beyond what is provided.`;
};

const ASSISTANT_MODEL = import.meta.env.VITE_ASSISTANT_MODEL;

const AssistantPage = () => {
  const { loading, canAccess, initialized } = useSubscriptionAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>(() => [
    createMessage(
      'assistant',
      "Hello! I'm Cortexa Assistant. I have live market data loaded — ask me about rising coins, current prices, market conditions, or anything trading-related.",
      { isIntro: true }
    ),
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketCtx, setMarketCtx] = useState<MarketContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const systemPromptRef = useRef<string>(buildSystemPrompt(null));

  // Load live market context on mount
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const [items, newsResp] = await Promise.all([
          fetchMarketSummary({ limit: 100 }),
          fetchNews({ currency: 'BTC', limit: 5 }),
        ]);

        if (!alive) return;

        const sorted = [...items]
          .filter((i) => i.price_change_percent != null)
          .sort((a, b) => (b.price_change_percent ?? 0) - (a.price_change_percent ?? 0));

        const gainers = sorted.slice(0, 5);
        const losers = sorted.slice(-5).reverse();
        const bySymbol = new Map(items.map((i) => [i.symbol, i]));
        const major = MAJOR_SYMBOLS.map((s) => bySymbol.get(s)).filter(Boolean) as MarketSummaryItem[];
        const newsHeadlines = (newsResp.items ?? []).slice(0, 5).map((n) => n.title);

        const ctx: MarketContext = {
          gainers,
          losers,
          major,
          newsHeadlines,
          fetchedAt: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        };

        setMarketCtx(ctx);
        systemPromptRef.current = buildSystemPrompt(ctx);
      } catch {
        // silently fall back to base prompt
      } finally {
        if (alive) setCtxLoading(false);
      }
    };

    void load();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const preset = searchParams.get('prompt');
    if (!preset) return;
    setInput(preset);
    const next = new URLSearchParams(searchParams);
    next.delete('prompt');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pending]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || pending) return;

    const userMessage = createMessage('user', input.trim());
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setPending(true);
    setError(null);

    try {
      const payload: ChatMessagePayload[] = [
        { role: 'system', content: systemPromptRef.current },
        ...[...messages, userMessage]
          .filter((m) => !m.isIntro)
          .map(({ role, content }) => ({ role, content })),
      ];
      const response = await sendChat({ messages: payload, model: ASSISTANT_MODEL });
      if (!response.ok) {
        setError(response.reason ?? 'Assistant unavailable');
        return;
      }
      setMessages((prev) => [...prev, createMessage('assistant', response.reply)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach the assistant');
    } finally {
      setPending(false);
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  if (loading || !initialized) {
    return (
      <div className="flex h-full min-h-0 flex-col space-y-6">
        <div className="h-5 w-40 animate-pulse rounded-full bg-muted/80" />
        <div className="flex-1 animate-pulse rounded-3xl border border-outline/40 bg-surface" />
      </div>
    );
  }

  if (!canAccess) {
    return <Paywall title="Premium feature" description="Upgrade your plan to unlock the Cortexa Assistant." />;
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 lg:h-full lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col">
        <article className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-outline/40 bg-surface shadow-elevation-soft sm:rounded-[28px]">
          {/* Market context bar */}
          <div className="shrink-0 border-b border-outline/20 px-4 py-2 sm:px-6">
            {ctxLoading ? (
              <p className="text-[11px] text-slate-500">Loading live market data…</p>
            ) : marketCtx ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Live data</span>
                {marketCtx.major.slice(0, 3).map((c) => {
                  const pos = (c.price_change_percent ?? 0) >= 0;
                  return (
                    <span key={c.symbol} className="text-[11px] text-slate-300">
                      {c.symbol.replace('USDT', '')}
                      {' '}
                      <span className={pos ? 'text-emerald-300' : 'text-rose-300'}>
                        {pos ? '+' : ''}{fmt(c.price_change_percent)}%
                      </span>
                    </span>
                  );
                })}
                {marketCtx.gainers[0] && (
                  <span className="text-[11px] text-emerald-300">
                    🔥 {marketCtx.gainers[0].symbol.replace('USDT', '')} +{fmt(marketCtx.gainers[0].price_change_percent)}%
                  </span>
                )}
                <span className="ml-auto text-[10px] text-slate-600">{marketCtx.fetchedAt}</span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">Market data unavailable — using general knowledge</p>
            )}
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
            <div className="space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'assistant' ? '' : 'justify-end'}`}>
                  {message.role === 'assistant' && (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline/50 bg-surface text-xs font-semibold uppercase text-white" aria-hidden>
                      AI
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-3xl border px-4 py-3 text-sm leading-relaxed shadow-inner-glow transition sm:max-w-[78%] sm:px-5 sm:py-4 lg:max-w-4xl ${
                    message.role === 'assistant'
                      ? 'border-outline/40 bg-muted/60 text-slate-200'
                      : 'border-white/60 bg-white/90 text-black'
                  }`}>
                    {message.content}
                  </div>
                  {message.role === 'user' && (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline/50 bg-surface text-xs font-semibold uppercase text-slate-300" aria-hidden>
                      You
                    </div>
                  )}
                </div>
              ))}
              {pending && (
                <div className="flex gap-3">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline/50 bg-surface text-xs font-semibold uppercase text-white">AI</div>
                  <div className="flex w-full max-w-[85%] items-center gap-1 rounded-2xl border border-outline/40 bg-muted/60 px-4 py-3 text-sm text-slate-200 sm:max-w-lg">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:240ms]" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="shrink-0 space-y-3 border-t border-outline/30 bg-surface/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask about rising coins, current prices, market conditions…"
              className="w-full rounded-2xl border border-outline/40 bg-canvas/70 px-4 py-3 text-sm text-ink placeholder:text-slate-500 focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
            />
            <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>Assistant responses are guidance, not investment advice.</p>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 self-start rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-inner-glow transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                disabled={pending || !input.trim()}
              >
                {pending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" aria-hidden />
                    <span>Thinking</span>
                  </>
                ) : (
                  'Send'
                )}
              </button>
            </div>
            {error && <p className="text-xs text-rose-300">{error}</p>}
          </form>
        </article>
      </section>
    </div>
  );
};

export default AssistantPage;
