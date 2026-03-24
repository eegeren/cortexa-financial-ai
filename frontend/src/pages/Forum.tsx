import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { createForumComment, createForumVote, fetchForumThreads, type ForumThread } from '@/services/api';
import { useToast } from '@/components/ToastProvider';

const TOPICS = ['All', 'Announcements', 'Strategy', 'Automation', 'Support'] as const;
type TopicFilter = (typeof TOPICS)[number];
type VoteKey = 'bullish' | 'bearish' | 'chop';

const LIVE_UPDATES = [
  { id: 'l1', title: 'Assistant prompt pack refreshed', href: '/assistant' },
  { id: 'l2', title: 'Signal methodology note published', href: '/signals' },
  { id: 'l3', title: 'Automation queue back to nominal latency', href: '/dashboard' }
];

const formatTime = (iso: string) => new Date(iso).toLocaleString();

const ForumPage = () => {
  const token = useAuthStore((state) => state.token);
  const email = useAuthStore((state) => state.email);
  const { pushToast } = useToast();
  const [topic, setTopic] = useState<TopicFilter>('All');
  const [query, setQuery] = useState('');
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busyThread, setBusyThread] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const rows = await fetchForumThreads({
          topic: topic === 'All' ? '' : topic,
          q: query.trim(),
        });
        if (!cancelled) {
          setThreads(rows);
        }
      } catch (error) {
        if (!cancelled) {
          pushToast(error instanceof Error ? error.message : 'Unable to load forum', 'warning');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [pushToast, query, topic]);

  const username = useMemo(() => {
    if (!email) {
      return null;
    }
    return `@${email.split('@')[0]}`;
  }, [email]);

  const handleVote = async (threadID: string, vote: VoteKey) => {
    if (!token) {
      pushToast('Please login to comment', 'warning');
      return;
    }
    setBusyThread(threadID);
    try {
      const votes = await createForumVote({ thread_id: threadID, vote });
      setThreads((prev) => prev.map((thread) => (thread.id === threadID ? { ...thread, votes } : thread)));
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Vote failed', 'warning');
    } finally {
      setBusyThread(null);
    }
  };

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>, threadID: string) => {
    event.preventDefault();
    if (!token) {
      pushToast('Please login to comment', 'warning');
      return;
    }
    const body = commentDrafts[threadID]?.trim() ?? '';
    if (!body) {
      return;
    }
    setBusyThread(threadID);
    try {
      const comment = await createForumComment({ thread_id: threadID, body });
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === threadID
            ? { ...thread, replies: thread.replies + 1, comments: [comment, ...thread.comments].slice(0, 8) }
            : thread
        )
      );
      setCommentDrafts((prev) => ({ ...prev, [threadID]: '' }));
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Comment failed', 'warning');
    } finally {
      setBusyThread(null);
    }
  };

  return (
    <div className="space-y-8 sm:space-y-12 lg:space-y-16">
      <section className="text-center">
        <header className="space-y-4">
          <span className="text-xs uppercase tracking-[0.4em] text-slate-500">Updates & forum</span>
          <h1 className="text-3xl font-semibold text-white sm:text-5xl">
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
              className={`rounded-full border px-3 py-2 transition ${
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
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-3xl border border-outline/30 bg-surface" />
            ))
          ) : (
            threads.map((thread) => {
              const totalVotes = thread.votes.bullish + thread.votes.bearish + thread.votes.chop;
              const toPct = (value: number) => (totalVotes > 0 ? Math.round((value / totalVotes) * 100) : 0);

              return (
                <article
                  key={thread.id}
                  className="rounded-3xl border border-outline/40 bg-surface p-5 shadow-elevation-soft transition hover:border-outline sm:p-6"
                >
                  <header className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-outline/50 bg-muted/60 px-3 py-1 text-slate-200">
                        {thread.topic}
                      </span>
                      <span>Last update {formatTime(thread.last_activity)}</span>
                    </div>
                    <span className="font-mono text-slate-300">{thread.replies} replies</span>
                  </header>

                  <h2 className="mt-4 text-xl font-semibold text-white">{thread.title}</h2>
                  <div className="mt-2 text-xs text-slate-400">
                    Posted by <span className="text-slate-200">{thread.author}</span>
                  </div>

                  <div className="mt-5 rounded-2xl border border-outline/30 bg-muted/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Community view</p>
                      <p className="text-xs text-slate-400">
                        Bullish {toPct(thread.votes.bullish)}% | Bearish {toPct(thread.votes.bearish)}% | Chop {toPct(thread.votes.chop)}%
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {(['bullish', 'bearish', 'chop'] as VoteKey[]).map((vote) => (
                        <button
                          key={vote}
                          type="button"
                          disabled={!token || busyThread === thread.id}
                          onClick={() => handleVote(thread.id, vote)}
                          className={`rounded-2xl border px-4 py-3 text-sm transition ${
                            token
                              ? 'border-outline/40 bg-slate-950/35 text-slate-200 hover:border-outline hover:text-white'
                              : 'cursor-not-allowed border-outline/20 bg-slate-900/30 text-slate-500 opacity-70'
                          }`}
                        >
                          {vote === 'bullish' ? 'Bullish' : vote === 'bearish' ? 'Bearish' : 'Chop'}
                        </button>
                      ))}
                    </div>
                    {!token && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                        <span>Login to participate in discussion</span>
                        <Link to="/login" className="rounded-full border border-outline/40 px-3 py-1.5 text-slate-200 transition hover:text-white">
                          Login
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 rounded-2xl border border-outline/30 bg-muted/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Comments</p>
                      {username ? (
                        <span className="text-xs text-slate-400">You are commenting as {username}</span>
                      ) : (
                        <span className="text-xs text-slate-500">Login to participate in discussion</span>
                      )}
                    </div>

                    <form onSubmit={(event) => handleCommentSubmit(event, thread.id)} className="mt-3 space-y-3">
                      <textarea
                        value={commentDrafts[thread.id] ?? ''}
                        onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [thread.id]: event.target.value }))}
                        placeholder={token ? 'Add your comment' : 'Login to participate in discussion'}
                        disabled={!token || busyThread === thread.id}
                        className={`min-h-[96px] w-full rounded-2xl border px-4 py-3 text-sm transition focus:outline-none ${
                          token
                            ? 'border-outline/40 bg-slate-950/35 text-slate-100 placeholder:text-slate-500 focus:border-outline focus:ring-2 focus:ring-primary'
                            : 'cursor-not-allowed border-outline/20 bg-slate-900/20 text-slate-500'
                        }`}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {!token ? (
                          <div className="flex items-center gap-3 text-sm text-slate-400">
                            <span>Login to participate in discussion</span>
                            <Link to="/login" className="rounded-full border border-outline/40 px-3 py-1.5 text-slate-200 transition hover:text-white">
                              Login
                            </Link>
                          </div>
                        ) : (
                          <button
                            type="submit"
                            className="rounded-full border border-outline/40 px-4 py-2 text-sm text-slate-200 transition hover:border-outline hover:text-white"
                          >
                            Post comment
                          </button>
                        )}
                      </div>
                    </form>

                    <div className="mt-4 space-y-3">
                      {thread.comments.length ? (
                        thread.comments.map((comment) => (
                          <div key={comment.id} className="rounded-2xl border border-outline/20 bg-slate-950/25 px-4 py-3">
                            <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                              <span className="text-slate-200">@{comment.username}</span>
                              <span>{formatTime(comment.created_at)}</span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-200">{comment.body}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">No comments yet.</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}

          {!loading && threads.length === 0 && (
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
