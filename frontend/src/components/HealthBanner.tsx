import clsx from 'clsx';

interface Props {
  healthy: boolean;
}

const HealthBanner = ({ healthy }: Props) => {
  if (healthy) {
    return null;
  }
  return (
    <div
      className={clsx(
        'fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-500/40 bg-amber-900/90 px-3 py-2 text-xs text-amber-100 shadow-lg shadow-amber-900/40 backdrop-blur'
      )}
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" aria-hidden="true" />
      <span>Service health degraded. Some data may be stale while we recover.</span>
    </div>
  );
};

export default HealthBanner;
