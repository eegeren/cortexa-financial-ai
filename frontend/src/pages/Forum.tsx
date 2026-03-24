import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { createForumComment, createForumVote, fetchForumThreads, type ForumThread } from '@/services/api';
import { useToast } from '@/components/ToastProvider';
import usePremiumStatus from '@/hooks/usePremiumStatus';

const TOPICS = ['All', 'Announcements', 'Strategy', 'Automation', 'Support'] as const;
type TopicFilter = (typeof TOPICS)[number];
type VoteKey = 'bullish' | 'bearish' | 'chop';
type ReactionKey = 'like' | 'dislike';

const LIVE_UPDATES = [
  { id: 'l1', title: 'Assistant prompt pack refreshed', href: '/assistant' },
  { id: 'l2', title: 'Signal methodology note published', href: '/signals' },
  { id: 'l3', title: 'Automation queue back to nominal latency', href: '/dashboard' },
];

const avatarTone = (seed: string) => {
  const tones = [
    'from-cyan-500/30 to-sky-400/20 text-cyan-100',
    'from-indigo-500/30 to-violet-400/20 text-indigo-100',
    'from-emerald-500/30 to-teal-400/20 text-emerald-100',
    'from-amber-500/25 to-orange-400/20 text-amber-100',
  ];
  const code = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tones[code % tones.length];
};

const formatTime = (iso: string) => new Date(iso).toLocaleString();

const seedReactions = (threadID: string, commentID: number) => {
  const base = threadID.length + commentID;
  return {
    like: 2 + (base % 5),
    dislike: base % 3,
  };
};

const ReactionButton = ({
  type,
  count,
  active,
  onClick,
}: {
  type: ReactionKey;
  count: number;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
      active
        ? 'border-primary/40 bg-primary/15 text-white'
        : 'border-outline/25 bg-slate-950/35 text-slate-400 hover:border-outline/45 hover:text-slate-200'
    }`}
  >
    <span aria-hidden>{type === 'like' ? '👍' : '👎'}</span>
    {count}
  </button>
);

const ForumPage = () => {
  const token = useAuthStore((state) => state.token);
  const email = useAuthStore((state) => state.email);
  const firstName = useAuthStore((state) => state.firstName);
  const lastName = useAuthStore((state) => state.lastName);
  const { isPremium } = usePremiumStatus();
  const { pushToast } = useToast();
  const [topic, setTopic] = useState<TopicFilter>('All');
  const [query, setQuery] = useState('');
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerBody, setComposerBody] = useState('');
  const [activeThreadID, setActiveThreadID] = useState<string>('');
  const [busyThread, setBusyThread] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, { like: number; dislike: number }>>({});
  const [selectedReactions, setSelectedReactions] = useState<Record<string, ReactionKey | null>>({});

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

  useEffect(() => {
    if (!threads.length) {
      setActiveThreadID('');
      return;
    }
    if (!activeThreadID || !threads.some((thread) => thread.id === activeThreadID)) {
      setActiveThreadID(threads[0].id);
    }
  }, [activeThreadID, threads]);

  useEffect(() => {
    const nextCounts: Record<string, { like: number; dislike: number }> = {};
    threads.forEach((thread) => {
      thread.comments.forEach((comment) => {
        const key = `${thread.id}:${comment.id}`;
        nextCounts[key] = reactionCounts[key] ?? seedReactions(thread.id, comment.id);
      });
    });
    setReactionCounts(nextCounts);
  }, [threads]);

  const displayName = useMemo(() => {
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (fullName) {
      return fullName;
    }
    return email ?? 'Guest';
  }, [email, firstName, lastName]);

  const handleVote = async (threadID: string, vote: VoteKey) => {
    if (!token) {
      pushToast('Please login to comment', 'warning');
      return;
    }
    if (!isPremium) {
      pushToast('Upgrade to access full features', 'warning');
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

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeThreadID) {
      return;
    }
    if (!token) {
      pushToast('Please login to comment', 'warning');
      return;
    }
    if (!isPremium) {
      pushToast('Upgrade to access full features', 'warning');
      return;
    }
    const body = composerBody.trim();
    if (!body) {
      return;
    }
    setBusyThread(activeThreadID);
    try {
      const comment = await createForumComment({ thread_id: activeThreadID, body });
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === activeThreadID
            ? { ...thread, replies: thread.replies + 1, comments: [comment, ...thread.comments].slice(0, 8) }
            : thread
        )
      );
      setComposerBody('');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Comment failed', 'warning');
    } finally {
      setBusyThread(null);
    }
  };

  const handleReaction = (threadID: string, commentID: number, reaction: ReactionKey) => {
    const key = `${threadID}:${commentID}`;
    const current = selectedReactions[key];
    setReactionCounts((prev) => {
      const next = { ...(prev[key] ?? seedReactions(threadID, commentID)) };
      if (current) {
        next[current] = Math.max(0, next[current] - 1);
      }
      if (current !== reaction) {
        next[reaction] += 1;
      }
      return { ...prev, [key]: next };
    });
    setSelectedReactions((prev) => ({
      ...prev,
      [key]: current === reaction ? null : reaction,
    }));
  };

  const activeThread = useMemo(() => threads.find((thread) => thread.id === activeThreadID) ?? null, [activeThreadID, threads]);

  return (
    <div className="relative space-y-8 pb-32 sm:space-y-10 lg:space-y-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.08),transparent_30%),linear-gradient(180deg,#020617_0%,#081120_48%,#020617_100%)]" />

      <section className="space-y-6">
        <header className="text-center">
          <span className="text-xs uppercase tracking-[0.4em] text-slate-500">Community forum</span>
          <h1 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">
            Make the discussion feel as live as the market.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            Desk notes, strategy discussion, support context, and market reactions all sit in one cleaner, more readable feed.
          </p>
        </header>

        <div className="sticky top-20 z-20 rounded-[1.75rem] border border-white/10 bg-slate-950/80 px-5 py-4 shadow-[0_18px_50px_rgba(2,6,23,0.45)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Pinned prompt</p>
              <p className="mt-2 text-lg font-medium text-white">What do you think about the current market?</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {TOPICS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setTopic(entry)}
                  className={`rounded-full border px-3 py-2 text-xs transition ${
                    topic === entry
                      ? 'border-primary/50 bg-primary/15 text-white'
                      : 'border-outline/30 bg-slate-900/40 text-slate-300 hover:border-outline/50 hover:text-white'
                  }`}
                >
                  {entry}
                </button>
              ))}
            </div>
          </div>

          <form className="mt-4">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search discussions, strategies, support notes..."
              className="w-full rounded-full border border-outline/30 bg-slate-900/45 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </form>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.45fr_0.75fr]">
        <div className="space-y-5">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-[1.9rem] border border-outline/20 bg-slate-900/45" />
            ))
          ) : threads.length ? (
            threads.map((thread) => {
              const totalVotes = thread.votes.bullish + thread.votes.bearish + thread.votes.chop;
              const toPct = (value: number) => (totalVotes > 0 ? Math.round((value / totalVotes) * 100) : 0);

              return (
                <article
                  key={thread.id}
                  className="rounded-[1.9rem] border border-white/10 bg-slate-950/58 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.35)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_24px_80px_rgba(8,47,73,0.22)] sm:p-6"
                >
                  <header className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="rounded-full border border-outline/30 bg-slate-900/55 px-3 py-1 text-slate-200">
                        {thread.topic}
                      </span>
                      <span>{formatTime(thread.last_activity)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveThreadID(thread.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        activeThreadID === thread.id
                          ? 'border-primary/45 bg-primary/15 text-white'
                          : 'border-outline/25 bg-slate-900/35 text-slate-400 hover:border-outline/45 hover:text-white'
                      }`}
                    >
                      Reply here
                    </button>
                  </header>

                  <div className="mt-5 flex items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarTone(thread.author)} text-sm font-semibold`}>
                      {(thread.author || 'C').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-semibold text-white">{thread.title}</h2>
                      <p className="mt-2 text-sm text-slate-400">
                        Posted by <span className="font-medium text-slate-200">{thread.author}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[1.5rem] border border-outline/20 bg-slate-900/45 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Market pulse</p>
                      <p className="text-xs text-slate-400">
                        Bullish {toPct(thread.votes.bullish)}% | Bearish {toPct(thread.votes.bearish)}% | Chop {toPct(thread.votes.chop)}%
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {(['bullish', 'bearish', 'chop'] as VoteKey[]).map((vote) => (
                        <button
                          key={vote}
                          type="button"
                          disabled={!token || !isPremium || busyThread === thread.id}
                          onClick={() => handleVote(thread.id, vote)}
                          className={`rounded-2xl border px-4 py-3 text-sm transition ${
                            token && isPremium
                              ? 'border-outline/30 bg-slate-950/35 text-slate-200 hover:border-outline/50 hover:text-white'
                              : 'cursor-not-allowed border-outline/20 bg-slate-900/25 text-slate-500 opacity-70'
                          }`}
                        >
                          {vote === 'bullish' ? 'Bullish' : vote === 'bearish' ? 'Bearish' : 'Chop'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {thread.comments.length ? (
                      thread.comments.map((comment) => {
                        const reactionKey = `${thread.id}:${comment.id}`;
                        const reactions = reactionCounts[reactionKey] ?? seedReactions(thread.id, comment.id);

                        return (
                          <div
                            key={comment.id}
                            className="rounded-[1.6rem] border border-white/8 bg-slate-900/52 px-4 py-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-slate-900/68 sm:px-5"
                          >
                            <div className="flex items-start gap-3">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarTone(comment.username || 'A')} text-xs font-semibold`}>
                                {(comment.username || 'A').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-white">{comment.username || 'Anonymous'}</p>
                                  <p className="text-xs text-slate-500">{formatTime(comment.created_at)}</p>
                                </div>
                                <p className="mt-2 text-sm leading-7 text-slate-200">{comment.body}</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <ReactionButton
                                    type="like"
                                    count={reactions.like}
                                    active={selectedReactions[reactionKey] === 'like'}
                                    onClick={() => handleReaction(thread.id, comment.id, 'like')}
                                  />
                                  <ReactionButton
                                    type="dislike"
                                    count={reactions.dislike}
                                    active={selectedReactions[reactionKey] === 'dislike'}
                                    onClick={() => handleReaction(thread.id, comment.id, 'dislike')}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-[1.6rem] border border-dashed border-outline/25 bg-slate-900/35 px-5 py-8 text-center text-sm text-slate-400">
                        Start the first discussion
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[1.9rem] border border-outline/25 bg-slate-950/55 p-12 text-center text-slate-300">
              <p className="text-lg font-medium text-white">Start the first discussion</p>
              <p className="mt-3 text-sm text-slate-400">There are no visible threads yet for this filter.</p>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/58 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
            <h3 className="text-lg font-semibold text-white">Discussion status</h3>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              {activeThread
                ? `You are replying to "${activeThread.title}".`
                : 'Choose a thread to anchor your next message.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {threads.slice(0, 4).map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadID(thread.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    activeThreadID === thread.id
                      ? 'border-primary/45 bg-primary/15 text-white'
                      : 'border-outline/25 bg-slate-900/35 text-slate-400 hover:border-outline/45 hover:text-white'
                  }`}
                >
                  {thread.topic}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/58 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
            <h3 className="text-lg font-semibold text-white">Live updates</h3>
            <p className="mt-2 text-sm leading-7 text-slate-400">Quick desk alerts impacting your playbooks.</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {LIVE_UPDATES.map((entry) => (
                <li key={entry.id}>
                  <Link to={entry.href} className="transition hover:text-white">
                    {entry.title} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/58 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
            <h3 className="text-lg font-semibold text-white">Posting notes</h3>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-400">
              <li>Add timeframe and data source when referencing a signal.</li>
              <li>Keep discussion factual and tied to market structure.</li>
              <li>Premium users can vote and join the conversation directly.</li>
            </ul>
          </div>
        </aside>
      </section>

      <div className="sticky bottom-3 z-30">
        <form
          onSubmit={handleCommentSubmit}
          className="rounded-[1.75rem] border border-white/10 bg-slate-950/88 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.5)] backdrop-blur-xl sm:p-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Share your thoughts</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {activeThread ? `Posting into ${activeThread.topic}` : 'Choose a thread to reply.'}
                  </p>
                </div>
                {username && <p className="text-xs text-slate-500">{username}</p>}
              </div>

              <textarea
                value={composerBody}
                onChange={(event) => setComposerBody(event.target.value)}
                placeholder={token && isPremium ? 'Share your thoughts...' : 'Login or upgrade to join the discussion'}
                disabled={!token || !isPremium || !activeThreadID || busyThread === activeThreadID}
                className={`min-h-[92px] w-full rounded-[1.4rem] border px-4 py-3 text-sm transition focus:outline-none ${
                  token && isPremium && activeThreadID
                    ? 'border-outline/30 bg-slate-900/55 text-slate-100 placeholder:text-slate-500 focus:border-outline/50 focus:ring-2 focus:ring-primary'
                    : 'cursor-not-allowed border-outline/20 bg-slate-900/30 text-slate-500'
                }`}
              />
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              {!token ? (
                <Link to="/login" className="rounded-full border border-outline/30 px-4 py-2.5 text-sm text-slate-200 transition hover:text-white">
                  Login
                </Link>
              ) : !isPremium ? (
                <Link to="/pricing" className="rounded-full border border-outline/30 px-4 py-2.5 text-sm text-slate-200 transition hover:text-white">
                  Upgrade
                </Link>
              ) : (
                <button
                  type="submit"
                  disabled={!activeThreadID || busyThread === activeThreadID}
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Post
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForumPage;
