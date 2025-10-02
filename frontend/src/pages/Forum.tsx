import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const TOPICS = ['All', 'Announcements', 'Strategy', 'Automation', 'Support'] as const;
type TopicFilter = (typeof TOPICS)[number];

type Thread = {
  id: string;
  title: string;
  topic: TopicFilter;
  replies: number;
  author: string;
  lastActivity: string; // ISO string
};

const THREADS: Thread[] = [
  {
    id: 't1',
    title: 'Desk briefing: BTC volatility regimes for the New York session',
    topic: 'Announcements',
    replies: 12,
    author: 'cortexa-desk',
    lastActivity: new Date().toISOString(),
  },
  {
    id: 't2',
    title: 'Strategy share: Multi-timeframe ladder for SOL after CPI print',
    topic: 'Strategy',
    replies: 8,
    author: 'liquidity_hunter',
    lastActivity: new Date(Date.now() - 7200_000).toISOString(),
  },
  {
    id: 't3',
    title: 'Automation recipe: Webhook triggers for ETH basis trades',
    topic: 'Automation',
    replies: 5,
    author: 'ops',
    lastActivity: new Date(Date.now() - 14_400_000).toISOString(),
  },
  {
    id: 't4',
    title: 'Support: Binance auto-trade credentials rotating every restart',
    topic: 'Support',
    replies: 3,
    author: 'flowstate',
    lastActivity: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

const LIVE_UPDATES = [
  {
    id: 'l1',
    title: 'Assistant prompt pack: risk management overlays',
    href: '/assistant',
  },
  {
    id: 'l2',
    title: 'New signal methodology note pushed to docs',
    href: '/signals',
  },
  {
    id: 'l3',
    title: 'Status: automation queue back to nominal latency',
    href: '/dashboard',
  },
];

const formatTime = (iso: string) => new Date(iso).toLocaleString();

const ForumPage = () => {
  const [topic, setTopic] = useState<TopicFilter>('All');
  const [query, setQuery] = useState('');

  const filteredThreads = useMemo(() => {
    return THREADS.filter((thread) => {
      const matchesTopic = topic === 'All' || thread.topic === topic;
      const matchesQuery =
        query.trim() === '' || thread.title.toLowerCase().includes(query.trim().toLowerCase());
      return matchesTopic && matchesQuery;
    });
  }, [topic, query]);

  return (
    <div className="space-y-12">
      <section className="rounded-3xl border border-outline/40 bg-surface/70 p-8 shadow-elevation-soft backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-outline/60 bg-surface/70 px-3 py-1 text-xs uppercase tracking-[0.4em] text-slate-400">
              Cortexa forum
            </span>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Swap playbooks and stay in sync with the desk.</h1>
            <p className="max-w-2xl text-base text-slate-300">
              Browse strategy breakdowns, automation recipes, and support updates from the trading desk and community.
              Keep feedback loops tight between signals, assistant insights, and execution routines.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {TOPICS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setTopic(entry)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    topic === entry
                      ? 'border-primary bg-primary/20 text-white'
                      : 'border-outline/50 bg-surface/60 text-slate-300 hover:border-outline'
                  }`}
                >
                  {entry}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full max-w-sm space-y-3">
            <label className="block text-xs uppercase tracking-[0.28em] text-slate-400">Search threads</label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search topics, e.g. volatility or automation"
              className="w-full rounded-full border border-outline/50 bg-canvas/60 px-4 py-2 text-sm text-ink placeholder:text-slate-500 focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
            <p className="text-xs text-slate-500">Forum syncs with assistant suggestions and dashboard alerts.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {filteredThreads.map((thread) => (
            <article
              key={thread.id}
              className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft transition hover:border-outline"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-outline/50 bg-surface/60 px-3 py-1 text-slate-300">
                    {thread.topic}
                  </span>
                  <span>Last update {formatTime(thread.lastActivity)}</span>
                </div>
                <span className="font-mono text-slate-300">{thread.replies} replies</span>
              </div>
              <h2 className="mt-4 text-xl font-semibold text-white">{thread.title}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>Started by <span className="text-slate-200">{thread.author}</span></span>
                <span className="rounded-full border border-outline/40 px-2 py-0.5 text-[11px] text-slate-400">Desk verified</span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-accent">
                <Link to="/assistant" className="transition hover:text-white">
                  Ask assistant about this thread →
                </Link>
                <Link to="/signals" className="transition hover:text-white">
                  Load related signals →
                </Link>
                <button
                  type="button"
                  disabled
                  className="rounded-full border border-outline/50 px-3 py-1 text-[11px] text-slate-400 opacity-70"
                  title="Thread interactions coming soon"
                >
                  Join discussion
                </button>
              </div>
            </article>
          ))}

          {filteredThreads.length === 0 && (
            <div className="rounded-3xl border border-outline/40 bg-surface/70 p-12 text-center text-slate-400">
              No threads match this filter. Try searching a different keyword.
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <div className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft">
            <h3 className="text-lg font-semibold text-white">Pinned resources</h3>
            <p className="mt-1 text-sm text-slate-400">
              Handpicked docs and playbooks from the Cortexa team.
            </p>
            <ul className="mt-4 space-y-3 text-sm text-accent">
              <li>
                <Link to="/signals" className="transition hover:text-white">
                  Signal methodology changelog →
                </Link>
              </li>
              <li>
                <Link to="/assistant" className="transition hover:text-white">
                  Assistant prompt pack for risk reviews →
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="transition hover:text-white">
                  Portfolio automation health dashboard →
                </Link>
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft">
            <h3 className="text-lg font-semibold text-white">Live updates</h3>
            <p className="mt-1 text-sm text-slate-400">Fresh desk alerts that may impact your playbooks.</p>
            <ul className="mt-4 space-y-2 text-xs text-accent">
              {LIVE_UPDATES.map((entry) => (
                <li key={entry.id}>
                  <Link to={entry.href} className="transition hover:text-white">
                    {entry.title} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft text-xs text-slate-300">
            <h3 className="text-lg font-semibold text-white">Posting guidelines</h3>
            <ul className="mt-3 space-y-2 list-disc pl-4">
              <li>Share timeframes, instruments, and data sources with every thread.</li>
              <li>Flag automation issues with reproduction steps and account IDs.</li>
              <li>Keep discussion factual; opinions are labelled clearly.</li>
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">Community moderation aligns with our trading desk conduct policy.</p>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default ForumPage;
