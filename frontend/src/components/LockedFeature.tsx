import { Link } from 'react-router-dom';

interface Props {
  title: string;
  description: string;
  ctaLabel?: string;
}

const LockedFeature = ({ title, description, ctaLabel = 'Upgrade' }: Props) => {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/60 p-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary">
        ★
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
      <Link
        to="/pricing"
        className="mt-4 inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary/80"
      >
        {ctaLabel}
      </Link>
    </div>
  );
};

export default LockedFeature;
