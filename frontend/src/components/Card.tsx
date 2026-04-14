import { PropsWithChildren } from 'react';
import clsx from 'clsx';

interface CardProps {
  className?: string;
  glow?: boolean;
}

const Card = ({ children, className, glow = true }: PropsWithChildren<CardProps>) => (
  <div
    className={clsx(
      'ui-surface relative overflow-hidden rounded-xl p-4 sm:p-5',
      className?.includes('border-primary') || className?.includes('border-emerald') || className?.includes('bg-primary') || className?.includes('bg-emerald')
        ? 'border-[rgba(29,158,117,0.3)] bg-[rgba(29,158,117,0.04)]'
        : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)]',
      glow && 'card-glow',
      className
    )}
  >
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
    />
    {children}
  </div>
);

export default Card;
