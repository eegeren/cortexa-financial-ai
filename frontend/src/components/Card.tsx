import { PropsWithChildren } from 'react';
import clsx from 'clsx';

interface CardProps {
  className?: string;
  glow?: boolean;
}

const Card = ({ children, className, glow = true }: PropsWithChildren<CardProps>) => (
  <div
    className={clsx(
      'ui-surface relative overflow-hidden rounded-2xl p-5',
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
