import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Paywall from '@/components/Paywall';
import type { ChatMessagePayload, ChatResponse } from '@/services/api';
import { sendChat } from '@/lib/api';
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
  const { loading, canAccess, initialized } = useSubscriptionAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>(() => [
    createMessage(
      'assistant',
      'Hello! I’m Cortexa Assistant. Need market context, a signal breakdown, or an automation checklist? Drop it here and we’ll tackle it together.',
      { isIntro: true }
    ),
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const preset = searchParams.get('prompt');
    if (!preset) {
      return;
    }
    setInput(preset);
    const next = new URLSearchParams(searchParams);
    next.delete('prompt');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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
      const response = await sendChat<ChatResponse>({
        messages: payload,
        model: ASSISTANT_MODEL,
      });
      if (!response.ok) {
        setError(response.reason ?? 'Assistant unavailable');
        return;
      }
      const assistantMessage = createMessage('assistant', response.reply);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reach the assistant';
      setError(message);
    } finally {
      setPending(false);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  };

  if (loading || !initialized) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-40 rounded-full bg-muted/80 animate-pulse" />
        <div className="h-[520px] rounded-3xl border border-outline/40 bg-surface animate-pulse" />
      </div>
    );
  }

  if (!canAccess) {
    return <Paywall title="Premium feature" description="Upgrade your plan to unlock the Cortexa Assistant." />;
  }

  return (
    <div className="flex w-full flex-1">
      <section className="flex flex-1 flex-col">
        <article className="flex min-h-screen flex-1 flex-col border-l border-outline/40 bg-surface px-4 py-6 shadow-elevation-soft sm:px-6">
          <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'assistant' ? '' : 'justify-end'}`}>
                  {message.role === 'assistant' && (
                    <div
                      className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline/50 bg-surface text-xs font-semibold uppercase text-white"
                      aria-hidden="true"
                    >
                      AI
                    </div>
                  )}
                  <div
                    className={`max-w-4xl rounded-3xl border px-5 py-4 text-sm leading-relaxed shadow-inner-glow transition ${
                      message.role === 'assistant'
                        ? 'border-outline/40 bg-muted/60 text-slate-200'
                        : 'border-white/60 bg-white/90 text-black'
                    }`}
                  >
                  {message.content}
                </div>
                  {message.role === 'user' && (
                    <div
                      className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline/50 bg-surface text-xs font-semibold uppercase text-slate-300"
                      aria-hidden="true"
                    >
                      You
                    </div>
                  )}
                </div>
              ))}
              {pending && (
                <div className="flex gap-3">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline/50 bg-surface text-xs font-semibold uppercase text-white">
                    AI
                  </div>
                  <div className="flex w-full max-w-lg items-center gap-1 rounded-2xl border border-outline/40 bg-muted/60 px-4 py-3 text-sm text-slate-200">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:240ms]" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type your request for the assistant..."
              className="w-full rounded-2xl border border-outline/40 bg-canvas/70 px-4 py-3 text-sm text-ink placeholder:text-slate-500 focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
            />
            <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>Assistant responses are guidance, not investment advice.</p>
              <button
                type="submit"
                className="inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-inner-glow transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
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
