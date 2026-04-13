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

const accentBarColor: Record<Required<MetricCardProps>['accent'], string> = {
  emerald: 'bg-emerald-500',
  blue:    'bg-blue-500',
  amber:   'bg-amber-500',
  slate:   'bg-slate-700',
};

const accentClass: Record<Required<MetricCardProps>['accent'], string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  blue:    'border-blue-500/30 bg-blue-500/10 text-blue-100',
  amber:   'border-amber-500/30 bg-amber-500/10 text-amber-100',
  slate:   'border-slate-700/60 bg-slate-900/70 text-slate-200',
};

const deltaPillClass: Record<NonNullable<MetricCardProps['deltaTone']>, string> = {
  positive: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20',
  negative: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/20',
  neutral:  'bg-slate-700/40 text-slate-400 ring-1 ring-slate-700/40',
};

const MetricCard = ({
  label,
  value,
  hint,
  accent = 'slate',
  deltaLabel,
  deltaTone = 'neutral',
  className,
}: MetricCardProps) => (
  <div
    className={clsx(
      'card-glow relative overflow-hidden rounded-xl border p-4 backdrop-blur-sm transition',
      accentClass[accent],
      className
    )}
  >
    {/* Accent top bar */}
    <div className={clsx('absolute inset-x-0 top-0 h-0.5', accentBarColor[accent])} />

    <div className="flex items-start justify-between gap-2 pt-1">
      <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{label}</p>
      {deltaLabel && (
        <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold', deltaPillClass[deltaTone])}>
          {deltaLabel}
        </span>
      )}
    </div>

    <div className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</div>
    {hint && <div className="mt-1.5 text-xs text-slate-400">{hint}</div>}
  </div>
);

export default MetricCard;
