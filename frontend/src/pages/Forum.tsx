import { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";

type Thread = {
  id: string;
  title: string;
  topic: "Crypto" | "Stocks" | "Forex" | "Macro";
  replies: number;
  votes: number;
  author: string;
  lastActivity: string; // ISO
};

const MOCK: Thread[] = [
  { id: "t1", title: "BTCUSDT 15m trend tartışması", topic: "Crypto", replies: 18, votes: 42, author: "quantler", lastActivity: new Date().toISOString() },
  { id: "t2", title: "BIST-30’de volatilite rejimi", topic: "Stocks", replies: 5, votes: 11, author: "alpaka", lastActivity: new Date(Date.now() - 3_600_000).toISOString() },
  { id: "t3", title: "DXY ve altın korelasyonu", topic: "Macro", replies: 9, votes: 21, author: "mergen", lastActivity: new Date(Date.now() - 7_200_000).toISOString() },
  { id: "t4", title: "EURUSD NFP sonrası plan", topic: "Forex", replies: 12, votes: 19, author: "fxmike", lastActivity: new Date(Date.now() - 86_400_000).toISOString() },
];

const TOPICS = ["All", "Crypto", "Stocks", "Forex", "Macro"] as const;
type TopicFilter = (typeof TOPICS)[number];

export default function Forum() {
  const [topic, setTopic] = useState<TopicFilter>("All");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");

  const filtered = useMemo(() => {
    return MOCK.filter(t =>
      (topic === "All" || t.topic === topic) &&
      (query.trim() === "" || t.title.toLowerCase().includes(query.toLowerCase()))
    );
  }, [topic, query]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Helmet>
        <title>Forum • Cortexa Trade</title>
      </Helmet>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Forum</h1>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search threads…"
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-primary/60"
          />
          <Link
            to="/dashboard"
            className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            ← Back to dashboard
          </Link>
        </div>
      </header>

      {/* topics */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TOPICS.map(t => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              topic === t
                ? "border-primary/60 bg-primary/10 text-slate-50"
                : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* composer (şimdilik pasif) */}
      <div className="mb-6 rounded-xl border border-slate-800/70 bg-slate-900/60 p-4 backdrop-blur-sm">
        <p className="mb-2 text-sm text-slate-400">Start a new thread</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Your idea, chart link, or question…"
          className="h-24 w-full resize-y rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-700 focus:ring-1 focus:ring-primary/50"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">Markdown supported soon • Be respectful</span>
          <button
            disabled
            className="rounded-full bg-primary/60 px-4 py-2 text-xs font-medium text-slate-50 opacity-60"
            title="Coming soon"
          >
            Post
          </button>
        </div>
      </div>

      {/* thread list */}
      <div className="space-y-3">
        {filtered.map(t => (
          <article
            key={t.id}
            className="relative overflow-hidden rounded-xl border border-slate-800/70 bg-slate-900/60 p-4 transition hover:border-slate-700/70"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="flex items-start gap-4">
              <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950/60 py-2">
                <div className="text-xs text-slate-400">Votes</div>
                <div className="font-mono text-lg tabular-nums text-slate-100">{t.votes}</div>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 text-base font-semibold text-slate-100">{t.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2 py-0.5">{t.topic}</span>
                  <span>by <span className="text-slate-300">{t.author}</span></span>
                  <span>•</span>
                  <span className="font-mono tabular-nums">{t.replies} replies</span>
                  <span>•</span>
                  <time dateTime={t.lastActivity}>{new Date(t.lastActivity).toLocaleString()}</time>
                </div>
              </div>
              <button
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-primary hover:text-white"
                title="Open thread (coming soon)"
                disabled
              >
                View
              </button>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-8 text-center text-slate-400">
            No threads yet for this filter.
          </div>
        )}
      </div>
    </div>
  );
}