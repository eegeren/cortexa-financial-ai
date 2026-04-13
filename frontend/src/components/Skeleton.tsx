import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
}

const Skeleton = ({ className }: SkeletonProps) => (
  <div className={clsx('animate-pulse rounded-lg bg-slate-800/60', className)} />
);

export default Skeleton;
