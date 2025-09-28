import { ReactNode } from 'react';
import clsx from 'clsx';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: 'emerald' | 'blue' | 'amber' | 'slate';
  deltaLabel?: string;
  deltaTone?: 'positive' | 'negative' | 'neutral';
  className?: string;
}

const accentClass: Record<Required<MetricCardProps>['accent'], string> = {
  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  blue: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
  slate: 'border-slate-700/60 bg-slate-900/70 text-slate-200'
};

const deltaToneClass: Record<NonNullable<MetricCardProps['deltaTone']>, string> = {
  positive: 'text-emerald-300',
  negative: 'text-rose-300',
  neutral: 'text-slate-400'
};

const MetricCard = ({
  label,
  value,
  hint,
  accent = 'slate',
  deltaLabel,
  deltaTone = 'neutral',
  className
}: MetricCardProps) => (
  <div
    className={clsx(
      'rounded-xl border p-4 transition hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 backdrop-blur-sm',
      accentClass[accent],
      className
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      {deltaLabel && <span className={clsx('text-[11px] font-semibold', deltaToneClass[deltaTone])}>{deltaLabel}</span>}
    </div>
    <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    {hint && <div className="mt-1 text-xs text-slate-300">{hint}</div>}
  </div>
);

export default MetricCard;
