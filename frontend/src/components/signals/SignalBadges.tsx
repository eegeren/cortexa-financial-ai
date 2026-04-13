import clsx from 'clsx';
import type { EdgeType, RegimeType } from '@/types/signal';

const edgeClasses: Record<EdgeType, string> = {
  long: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  short: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  limited: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  none: 'border-white/10 bg-white/5 text-[color:var(--text-muted)]',
};

const edgeLabels: Record<EdgeType, string> = {
  long: 'Long',
  short: 'Short',
  limited: 'Limited',
  none: 'None',
};

const regimeClasses: Record<RegimeType, string> = {
  trending: 'text-white',
  range: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  low: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
};

const regimeLabels: Record<RegimeType, string> = {
  trending: 'Trending',
  range: 'Range',
  low: 'Low vol',
};

export const EdgeBadge = ({ edge, className }: { edge: EdgeType; className?: string }) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
      edgeClasses[edge],
      className
    )}
  >
    {edgeLabels[edge]}
  </span>
);

export const RegimeLabel = ({ regime, className }: { regime: RegimeType; className?: string }) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]',
      regimeClasses[regime],
      className
    )}
    style={
      regime === 'trending'
        ? {
            borderColor: 'rgba(14, 165, 165, 0.3)',
            backgroundColor: 'rgba(14, 165, 165, 0.1)',
          }
        : undefined
    }
  >
    {regimeLabels[regime]}
  </span>
);

export const ScoreBar = ({ score, className }: { score: number; className?: string }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div className={clsx('w-full', className)}>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Score</span>
        <span className="font-semibold text-white">{clamped}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${clamped}%`, backgroundColor: 'var(--primary)' }}
        />
      </div>
    </div>
  );
};

export const timeAgo = (isoString: string) => {
  const value = new Date(isoString).getTime();
  if (!Number.isFinite(value)) {
    return 'az önce';
  }

  const diffMs = Date.now() - value;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return 'az önce';
  if (diffMinutes < 60) return `${diffMinutes} dk önce`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} sa önce`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} gün önce`;

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};
