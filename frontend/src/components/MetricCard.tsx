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
  emerald: 'bg-[#1D9E75]',
  blue:    'bg-[#7F77DD]',
  amber:   'bg-[#BA7517]',
  slate:   'bg-[rgba(255,255,255,0.18)]',
};

const accentClass: Record<Required<MetricCardProps>['accent'], string> = {
  emerald: 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-white',
  blue:    'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-white',
  amber:   'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-white',
  slate:   'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-white',
};

const deltaPillClass: Record<NonNullable<MetricCardProps['deltaTone']>, string> = {
  positive: 'bg-[rgba(29,158,117,0.15)] text-[#1D9E75] ring-1 ring-[rgba(29,158,117,0.2)]',
  negative: 'bg-[rgba(226,75,74,0.15)] text-[#E24B4A] ring-1 ring-[rgba(226,75,74,0.2)]',
  neutral:  'bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.45)] ring-1 ring-[rgba(255,255,255,0.07)]',
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
      'card-glow relative overflow-hidden rounded-[10px] border p-4 transition',
      accentClass[accent],
      className
    )}
  >
    {/* Accent top bar */}
    <div className={clsx('absolute inset-x-0 top-0 h-0.5', accentBarColor[accent])} />

    <div className="flex items-start justify-between gap-2 pt-1">
      <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-[rgba(255,255,255,0.3)]">{label}</p>
      {deltaLabel && (
        <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold', deltaPillClass[deltaTone])}>
          {deltaLabel}
        </span>
      )}
    </div>

    <div className="mt-3 text-[22px] font-bold tracking-tight text-white">{value}</div>
    {hint && <div className="mt-1.5 text-[11px] text-[rgba(255,255,255,0.3)]">{hint}</div>}
  </div>
);

export default MetricCard;
