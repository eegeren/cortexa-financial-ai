import { Link } from 'react-router-dom';

interface Props {
  title?: string;
  description?: string;
  ctaLabel?: string;
}

const Paywall = ({
  title = 'Upgrade required',
  description = 'Your trial has ended. Upgrade your plan to continue using premium features such as the AI assistant and advanced analytics.',
  ctaLabel = 'View pricing',
}: Props) => {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-slate-800/60 bg-slate-900/80 p-10 text-center shadow-2xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
        <span className="text-xl text-primary">⚡️</span>
      </div>
      <h2 className="mt-6 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">{description}</p>
      <Link
        to="/pricing"
        className="mt-6 inline-flex items-center rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary/80"
      >
        {ctaLabel}
      </Link>
      <p className="mt-4 text-xs text-slate-500">Need help? Contact support@cortexaai.net for enterprise access.</p>
    </div>
  );
};

export default Paywall;
