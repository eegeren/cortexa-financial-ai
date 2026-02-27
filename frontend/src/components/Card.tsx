import { PropsWithChildren } from 'react';
import clsx from 'clsx';

interface CardProps {
  className?: string;
}

const Card = ({ children, className }: PropsWithChildren<CardProps>) => (
  <div
    className={clsx(
      'relative rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/20 backdrop-blur',
      className
    )}
  >
    {children}
  </div>
);

export default Card;
