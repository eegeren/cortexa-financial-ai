import { Link } from 'react-router-dom';

type PremiumLockProps = {
  message?: string;
  className?: string;
};

const PremiumLock = ({
  message = 'Upgrade to access full features',
  className = '',
}: PremiumLockProps) => (
  <div className={`absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-slate-950/55 backdrop-blur-[2px] ${className}`}>
    <div className="mx-4 max-w-sm rounded-2xl border border-white/10 bg-slate-950/90 px-5 py-4 text-center shadow-[0_20px_60px_rgba(2,6,23,0.55)]">
      <p className="text-sm font-medium text-white">{message}</p>
      <Link
        to="/pricing"
        className="mt-3 inline-flex rounded-full border border-primary/40 bg-primary/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary transition hover:bg-primary/20 hover:text-white"
      >
        Upgrade to Premium
      </Link>
    </div>
  </div>
);

export default PremiumLock;
