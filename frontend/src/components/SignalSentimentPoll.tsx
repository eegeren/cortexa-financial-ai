import { useEffect, useMemo, useState } from 'react';

type VoteKey = 'bullish' | 'bearish' | 'chop';

type SignalSentimentPollProps = {
  symbol: string;
};

const LABELS: Record<VoteKey, string> = {
  bullish: 'Bullish',
  bearish: 'Bearish',
  chop: 'Chop',
};

const BUTTON_TONES: Record<VoteKey, string> = {
  bullish: 'border-emerald-400/30 hover:border-emerald-300/60 hover:bg-emerald-500/10',
  bearish: 'border-rose-400/30 hover:border-rose-300/60 hover:bg-rose-500/10',
  chop: 'border-slate-500/30 hover:border-slate-400/60 hover:bg-slate-500/10',
};

const baseCounts = { bullish: 12, bearish: 9, chop: 7 };

const SignalSentimentPoll = ({ symbol }: SignalSentimentPollProps) => {
  const storageKey = `cortexa:signal-vote:${symbol}`;
  const [selected, setSelected] = useState<VoteKey | null>(null);
  const [counts, setCounts] = useState(baseCounts);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setSelected(null);
      setCounts(baseCounts);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { selected?: VoteKey; counts?: typeof baseCounts };
      setSelected(parsed.selected ?? null);
      setCounts(parsed.counts ?? baseCounts);
    } catch {
      setSelected(null);
      setCounts(baseCounts);
    }
  }, [storageKey]);

  const total = counts.bullish + counts.bearish + counts.chop;
  const percentages = useMemo(
    () => ({
      bullish: Math.round((counts.bullish / total) * 100),
      bearish: Math.round((counts.bearish / total) * 100),
      chop: Math.max(0, 100 - Math.round((counts.bullish / total) * 100) - Math.round((counts.bearish / total) * 100)),
    }),
    [counts, total]
  );

  const handleVote = (vote: VoteKey) => {
    const nextCounts = { ...counts };
    if (selected) {
      nextCounts[selected] = Math.max(baseCounts[selected], nextCounts[selected] - 1);
    }
    nextCounts[vote] += 1;
    setCounts(nextCounts);
    setSelected(vote);
    window.localStorage.setItem(storageKey, JSON.stringify({ selected: vote, counts: nextCounts }));
  };

  return (
    <div className="rounded-2xl border border-outline/30 bg-muted/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">What do you think?</p>
          <p className="mt-2 text-xs text-slate-400">Related to market sentiment</p>
        </div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{symbol}</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {(Object.keys(LABELS) as VoteKey[]).map((vote) => (
          <button
            key={vote}
            type="button"
            onClick={() => handleVote(vote)}
            className={`rounded-2xl border px-4 py-3 text-sm transition ${
              selected === vote
                ? `${BUTTON_TONES[vote]} bg-slate-900/80 text-white`
                : `${BUTTON_TONES[vote]} bg-slate-950/35 text-slate-300`
            }`}
          >
            {LABELS[vote]}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">
        <span>Bullish {percentages.bullish}%</span>
        <span>Bearish {percentages.bearish}%</span>
        <span>Chop {percentages.chop}%</span>
      </div>
    </div>
  );
};

export default SignalSentimentPoll;
