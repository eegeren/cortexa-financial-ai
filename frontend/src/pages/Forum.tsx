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
  lastActivity: string;
};

const THREADS: Thread[] = [
  {
    id: 't1',
    title: 'Desk brief: BTC volatility regimes for the New York session',
    topic: 'Announcements',
    replies: 12,
    author: 'cortexa-desk',
    lastActivity: new Date().toISOString(),
  },
  {
    id: 't2',
    title: 'Strategy share: multi-timeframe ladder for SOL after CPI print',
    topic: 'Strategy',
    replies: 8,
    author: 'liquidity_hunter',
    lastActivity: new Date(Date.now() - 7200_000).toISOString(),
  },
  {
    id: 't3',
    title: 'Automation recipe: webhook triggers for ETH basis trades',
    topic: 'Automation',
    replies: 5,
    author: 'ops',
    lastActivity: new Date(Date.now() - 14_400_000).toISOString(),
  },
  {
    id: 't4',
    title: 'Support: Binance automation credentials rotate after restart',
    topic: 'Support',
    replies: 3,
    author: 'flowstate',
    lastActivity: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

const LIVE_UPDATES = [
  { id: 'l1', title: 'Assistant prompt pack refreshed', href: '/assistant' },
  { id: 'l2', title: 'Signal methodology note published', href: '/signals' },
  { id: 'l3', title: 'Automation queue back to nominal latency', href: '/dashboard' }
];

const formatTime = (iso: string) => new Date(iso).toLocaleString();

const ForumPage = () => {
  const [topic, setTopic] = useState<TopicFilter>('Tümü');
  const [query, setQuery] = useState('');

  const filteredThreads = useMemo(() => {
    return THREADS.filter((thread) => {
      const matchesTopic = topic === 'Tümü' || thread.topic === topic;
      const matchesQuery =
        query.trim() === '' || thread.title.toLowerCase().includes(query.trim().toLowerCase());
      return matchesTopic && matchesQuery;
    });
  }, [topic, query]);

  return (
    <div className="space-y-16">
      <section className="text-center">
        <header className="space-y-4">
          <span className="text-xs uppercase tracking-[0.4em] text-slate-500">Updates & forum</span>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">
            Catch desk notes, strategy drops, and support threads in one feed.
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-400">
            The Cortexa team and community share everything from signal changes to automation recipes. Stay in sync with what matters.
          </p>
        </header>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-400">
          {TOPICS.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setTopic(entry)}
              className={`rounded-full border px-3 py-1.5 transition ${
                topic === entry
                  ? 'border-primary bg-primary/20 text-white'
                  : 'border-outline/50 bg-surface text-slate-300 hover:border-outline'
              }`}
            >
              {entry}
            </button>
          ))}
        </div>
        <form className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search threads (automation, volatility, etc.)"
            className="w-full max-w-sm rounded-full border border-outline/50 bg-surface px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </form>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {filteredThreads.map((thread) => (
            <article
              key={thread.id}
              className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft transition hover:border-outline"
            >
              <header className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-outline/50 bg-muted/60 px-3 py-1 text-slate-200">
                    {thread.topic}
                  </span>
                  <span>Last update {formatTime(thread.lastActivity)}</span>
                </div>
                <span className="font-mono text-slate-300">{thread.replies} replies</span>
              </header>
              <h2 className="mt-4 text-xl font-semibold text-white">{thread.title}</h2>
              <div className="mt-2 text-xs text-slate-400">
                Posted by <span className="text-slate-200">{thread.author}</span> • Thread interactions coming soon.
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-accent">
                <Link to="/assistant" className="transition hover:text-white">
                  Summarise with the assistant →
                </Link>
                <Link to="/signals" className="transition hover:text-white">
                  View related signals →
                </Link>
                <button
                  type="button"
                  disabled
                  className="rounded-full border border-outline/50 px-3 py-1 text-[11px] text-slate-400 opacity-70"
                >
                  Join discussion
                </button>
              </div>
            </article>
          ))}

          {filteredThreads.length === 0 && (
            <div className="rounded-3xl border border-outline/40 bg-surface p-12 text-center text-slate-400">
              No threads match these filters yet.
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
            <h3 className="text-lg font-semibold text-white">Pinned resources</h3>
            <p className="mt-1 text-sm text-slate-400">Handpicked docs and playbooks from the desk.</p>
            <ul className="mt-4 space-y-3 text-sm text-accent">
              <li>
                <Link to="/signals" className="transition hover:text-white">
                  Signal methodology changelog →
                </Link>
              </li>
              <li>
                <Link to="/assistant" className="transition hover:text-white">
                  Assistant prompt pack →
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="transition hover:text-white">
                  Portfolio automation health →
                </Link>
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
            <h3 className="text-lg font-semibold text-white">Live updates</h3>
            <p className="mt-1 text-sm text-slate-400">Quick desk alerts impacting your playbooks.</p>
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

          <div className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft text-xs text-slate-300">
            <h3 className="text-lg font-semibold text-white">Posting guidelines</h3>
            <ul className="mt-3 space-y-2 list-disc pl-4">
              <li>Add timeframe and data sources when referencing signals.</li>
              <li>Include bot IDs and reproduction steps for automation issues.</li>
              <li>Keep discussion factual and consistent with desk standards.</li>
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">Enterprise plans include private forum spaces.</p>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default ForumPage;
