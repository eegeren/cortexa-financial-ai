type NewsCardProps = {
  title: string;
  source: string;
  publishedLabel: string;
  url: string;
  sentiment?: 'Bullish' | 'Bearish' | 'Neutral' | string;
};

const sentimentTone: Record<string, string> = {
  bullish: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100',
  bearish: 'border-rose-400/25 bg-rose-500/10 text-rose-100',
  neutral: 'border-slate-500/25 bg-slate-500/10 text-slate-200',
};

const NewsCard = ({ title, source, publishedLabel, url, sentiment = 'neutral' }: NewsCardProps) => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer"
    className="group rounded-3xl border border-outline/35 bg-surface p-5 shadow-elevation-soft transition hover:-translate-y-0.5 hover:border-outline/60 hover:bg-slate-900/80"
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">{source}</p>
        <h3 className="mt-3 text-base font-semibold leading-6 text-white transition group-hover:text-cyan-100">{title}</h3>
      </div>
      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${sentimentTone[sentiment] ?? sentimentTone.neutral}`}>
        {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
      </span>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400">
      <span>{publishedLabel}</span>
      <span className="text-slate-500 transition group-hover:text-slate-300">Open source →</span>
    </div>
  </a>
);

export default NewsCard;
