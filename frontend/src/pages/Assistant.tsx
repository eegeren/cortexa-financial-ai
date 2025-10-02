import { FormEvent, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Paywall from '@/components/Paywall';
import { sendChat, ChatMessagePayload } from '@/services/api';
import useSubscriptionAccess from '@/hooks/useSubscriptionAccess';

interface Message extends ChatMessagePayload {
  id: string;
  createdAt: number;
  isIntro?: boolean;
}

const createMessage = (role: Message['role'], content: string, extras: Partial<Message> = {}): Message => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: Date.now(),
  ...extras,
});

const SYSTEM_PROMPT = `You are Cortexa Assistant, a trading co-pilot. Provide concise, data-driven insights using clear bullet points when useful. Reference signal-derived metrics when the user asks about performance, highlight risk management, and remind users to validate with their own research when suggesting strategies. Refuse anything unrelated to trading, markets, or product support.`;

const ASSISTANT_MODEL = import.meta.env.VITE_ASSISTANT_MODEL;

const AssistantPage = () => {
  const { loading, canAccess, status, trialDays, initialized, plan } = useSubscriptionAccess();
  const [messages, setMessages] = useState<Message[]>(() => [
    createMessage(
      'assistant',
      'Hello, I’m Cortexa Assistant. Ask about market structure, signal rationale, or how to deploy automation. I can also draft execution checklists for you.',
      { isIntro: true }
    ),
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const quickPrompts = useMemo(
    () => [
      'Summarise today’s BTC regime shift and signal bias.',
      'Give me a checklist before arming ETH auto-trade.',
      'Compare SOL vs. AVAX signals for the next 6 hours.',
      'What drawdown safeguards should I use for my futures desk?',
    ],
    []
  );

  const usageStats = useMemo(() => {
    const userMessages = messages.filter((message) => message.role === 'user').length;
    const assistantMessages = messages.filter((message) => message.role === 'assistant').length;
    return { userMessages, assistantMessages };
  }, [messages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || pending) {
      return;
    }
    const userMessage = createMessage('user', input.trim());
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setPending(true);
    setError(null);

    try {
      const payload: ChatMessagePayload[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...[...messages, userMessage]
          .filter((message) => !message.isIntro)
          .map(({ role, content }) => ({ role, content })),
      ];
      const response = await sendChat(payload, ASSISTANT_MODEL);
      if (!response.ok) {
        setError(response.reason ?? 'Assistant unavailable');
        return;
      }
      const assistantMessage = createMessage('assistant', response.reply);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reach assistant';
      setError(message);
    } finally {
      setPending(false);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  };

  const handlePrompt = (prompt: string) => {
    if (pending) {
      return;
    }
    setInput(prompt);
  };

  if (loading || !initialized) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-40 rounded-full bg-surface/60 animate-pulse" />
        <div className="h-[520px] rounded-3xl border border-outline/40 bg-surface/70 animate-pulse" />
      </div>
    );
  }

  if (!canAccess) {
    return <Paywall title="Premium feature" description="Upgrade to Pro or Enterprise to unlock Cortexa Assistant." />;
  }

  const description = trialDays > 0
    ? `Status: ${status}. Trial remaining ${trialDays} day${trialDays === 1 ? '' : 's'}.`
    : 'Get market context, interpret signals, or draft execution playbooks in seconds.';

  return (
    <div className="space-y-14">
      <section className="rounded-3xl border border-outline/40 bg-surface/70 p-8 shadow-elevation-soft backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-outline/60 bg-surface/70 px-3 py-1 text-xs uppercase tracking-[0.4em] text-slate-400">
              Cortexa assistant
            </span>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">
              Converse with your trading co-pilot for instant strategy support.
            </h1>
            <p className="max-w-2xl text-base text-slate-300">{description}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="rounded-full border border-outline/50 px-3 py-1">Model: {ASSISTANT_MODEL ?? 'gpt-4o-mini'}</span>
              <span className="rounded-full border border-outline/50 px-3 py-1">Plan: {plan?.toUpperCase() ?? 'STARTER'}</span>
              <span className="rounded-full border border-outline/50 px-3 py-1">Messages: {usageStats.userMessages}</span>
            </div>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-outline/30 bg-surface/80 p-6 shadow-inner-glow">
            <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">Quick prompts</h2>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handlePrompt(prompt)}
                  className="rounded-xl border border-outline/40 bg-surface/60 px-3 py-2 text-left text-slate-200 transition hover:border-outline hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <article className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft">
          <div ref={scrollRef} className="h-[520px] overflow-y-auto pr-1">
            <div className="space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'assistant' ? '' : 'justify-end'}`}>
                  {message.role === 'assistant' && (
                    <div
                      className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline/50 bg-surface/80 text-xs font-semibold uppercase text-primary"
                      aria-hidden="true"
                    >
                      AI
                    </div>
                  )}
                  <div
                    className={`max-w-lg rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-inner-glow transition ${
                      message.role === 'assistant'
                        ? 'border-outline/40 bg-surface/80 text-slate-100'
                        : 'border-primary/30 bg-primary/20 text-white'
                    }`}
                  >
                    {message.content}
                  </div>
                  {message.role === 'user' && (
                    <div
                      className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline/50 bg-surface/80 text-xs font-semibold uppercase text-slate-300"
                      aria-hidden="true"
                    >
                      You
                    </div>
                  )}
                </div>
              ))}
              {pending && (
                <div className="flex gap-3">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline/50 bg-surface/80 text-xs font-semibold uppercase text-primary">
                    AI
                  </div>
                  <div className="flex w-full max-w-lg items-center gap-1 rounded-2xl border border-outline/40 bg-surface/80 px-4 py-3 text-sm text-slate-200">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask for signal breakdowns, plan automations, or risk guidance..."
              className="w-full rounded-2xl border border-outline/40 bg-canvas/70 px-4 py-3 text-sm text-ink placeholder:text-slate-500 focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary/60"
              rows={3}
            />
            <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>Assistant responses complement — not replace — your own diligence.</p>
              <button
                type="submit"
                className="inline-flex items-center gap-2 self-start rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={pending || !input.trim()}
              >
                {pending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden />
                    <span>Thinking</span>
                  </>
                ) : (
                  'Send message'
                )}
              </button>
            </div>
            {error && <p className="text-xs text-rose-300">{error}</p>}
          </form>
        </article>

        <aside className="flex flex-col gap-6">
          <div className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft">
            <h2 className="text-lg font-semibold text-white">Session stats</h2>
            <p className="mt-1 text-sm text-slate-400">Track how many prompts you’ve fired during this desk session.</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Your prompts</dt>
                <dd className="text-white">{usageStats.userMessages}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Assistant replies</dt>
                <dd className="text-white">{usageStats.assistantMessages}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Current plan</dt>
                <dd className="text-white">{plan?.toUpperCase() ?? 'STARTER'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Trial remaining</dt>
                <dd className="text-white">{trialDays > 0 ? `${trialDays} day${trialDays === 1 ? '' : 's'}` : '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft">
            <h2 className="text-lg font-semibold text-white">Workflow shortcuts</h2>
            <p className="mt-1 text-sm text-slate-400">Keep your research loop tight across the platform.</p>
            <div className="mt-4 space-y-2 text-xs text-accent">
              <Link to="/signals" className="block transition hover:text-white">
                Jump to live signals →
              </Link>
              <Link to="/dashboard" className="block transition hover:text-white">
                Review portfolio posture →
              </Link>
              <Link to="/forum" className="block transition hover:text-white">
                Browse trading playbooks →
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft text-xs text-slate-300">
            <h2 className="text-lg font-semibold text-white">Best practices</h2>
            <ul className="mt-3 space-y-2 list-disc pl-4">
              <li>Always mention the asset, timeframe, and horizon you’re targeting.</li>
              <li>Share risk parameters (stop size, max drawdown) for tailored guidance.</li>
              <li>Reference previous replies if you need refined or follow-up context.</li>
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">Enterprise adds private data feeds and bespoke fine-tuned assistants.</p>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default AssistantPage;
