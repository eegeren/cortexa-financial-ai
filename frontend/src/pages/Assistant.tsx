import { FormEvent, useMemo, useRef, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import Paywall from '@/components/Paywall';
import Skeleton from '@/components/Skeleton';
import { sendChat, ChatMessagePayload } from '@/services/api';
import useSubscriptionAccess from '@/hooks/useSubscriptionAccess';

interface Message extends ChatMessagePayload {
  id: string;
  createdAt: number;
}

const createMessage = (role: Message['role'], content: string): Message => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  role,
  content,
  createdAt: Date.now(),
});

const AssistantPage = () => {
  const { loading: subscriptionLoading, canAccess, status, trialDays, initialized } = useSubscriptionAccess();
  const [messages, setMessages] = useState<Message[]>([
    createMessage(
      'assistant',
      'Hi! I am Cortexa Assistant. Ask me about market structure, trading strategies, or how to interpret current AI signals.'
    ),
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || pending) {
      return;
    }
    const userMessage = createMessage('user', input.trim());
    setMessages((prev) => [...prev, userMessage]);
    setError(null);
    setInput('');
    setPending(true);

    try {
      const chatHistory: ChatMessagePayload[] = [...messages, userMessage].map(({ role, content }) => ({ role, content }));
      const response = await sendChat(chatHistory);
      if (!response.ok) {
        setError(response.reason ?? 'Assistant unavailable.');
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

  const headerDescription = useMemo(() => {
    if (!canAccess) {
      return 'Upgrade your plan to unlock the Cortexa Assistant and advanced insights.';
    }
    if (trialDays > 0) {
      return `Trial status: ${status}. ${trialDays} day${trialDays === 1 ? '' : 's'} remaining.`;
    }
    return 'Chat with our GPT-powered assistant for market context, signal breakdowns, and portfolio guidance.';
  }, [canAccess, status, trialDays]);

  if (subscriptionLoading || !initialized) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (!canAccess) {
    return <Paywall title="Premium feature" description="Upgrade to Pro or Enterprise to access Cortexa Assistant." />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Assistant" description={headerDescription} />

      <Card className="border border-slate-800/60 bg-slate-900/80 shadow-lg">
        <div ref={scrollRef} className="h-[520px] overflow-y-auto pr-2">
          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <div
                  className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                    message.role === 'assistant'
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-slate-700/60 bg-slate-800/70 text-slate-200'
                  }`}
                  aria-hidden="true"
                >
                  {message.role === 'assistant' ? 'AI' : 'You'}
                </div>
                <div
                  className={`w-full rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm transition ${
                    message.role === 'assistant'
                      ? 'border-primary/30 bg-primary/10 text-slate-100'
                      : 'border-slate-700/50 bg-slate-800/70 text-slate-200 backdrop-blur'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex gap-3">
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary">
                  AI
                </div>
                <div className="flex w-full rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-slate-100">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                  <span className="ml-1 h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
                  <span className="ml-1 h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
                </div>
              </div>
            )}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about current market conditions or request a backtest summary..."
            className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none"
            rows={3}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Cortexa Assistant can explain signals, summarise regimes, and suggest playbooks. Do not treat responses as
              investment advice.
            </p>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending || !input.trim()}
            >
              {pending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden />
                  <span>Thinking</span>
                </>
              ) : (
                'Send'
              )}
            </button>
          </div>
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </form>
      </Card>
    </div>
  );
};

export default AssistantPage;
