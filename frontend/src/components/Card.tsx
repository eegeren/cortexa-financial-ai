import { PropsWithChildren } from 'react';
import clsx from 'clsx';

interface CardProps {
  className?: string;
  glow?: boolean;
}

const Card = ({ children, className, glow = true }: PropsWithChildren<CardProps>) => (
  <div
    className={clsx(
      'relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/20 backdrop-blur',
      glow && 'card-glow',
      className
    )}
  >
    {/* Subtle shimmer line at the top */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
    />
    {children}
  </div>
);

export default Card;
