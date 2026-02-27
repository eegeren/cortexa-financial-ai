import { PropsWithChildren } from 'react';

interface BannerProps {
  tone?: 'info' | 'success' | 'warning' | 'error';
}

const toneClass: Record<Required<BannerProps>['tone'], string> = {
  info: 'bg-blue-500/10 text-blue-200 border-blue-500/40',
  success: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/40',
  warning: 'bg-amber-500/10 text-amber-200 border-amber-500/40',
  error: 'bg-red-500/10 text-red-200 border-red-500/40'
};

const Banner = ({ tone = 'info', children }: PropsWithChildren<BannerProps>) => (
  <div className={`rounded border px-4 py-3 text-sm ${toneClass[tone]}`}>{children}</div>
);

export default Banner;
