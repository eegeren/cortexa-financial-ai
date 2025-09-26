import { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: 'emerald' | 'blue' | 'amber' | 'slate';
}

const accentClass: Record<Required<MetricCardProps>['accent'], string> = {
  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  blue: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
  slate: 'border-slate-700/60 bg-slate-900/70 text-slate-200'
};

const MetricCard = ({ label, value, hint, accent = 'slate' }: MetricCardProps) => (
  <div className={`rounded-xl border p-4 transition hover:border-primary/60 ${accentClass[accent]}`}>
    <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
  </div>
);

export default MetricCard;
