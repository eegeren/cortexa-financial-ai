import clsx from 'clsx';

type BrandWordmarkProps = {
  className?: string;
};

const BrandWordmark = ({ className }: BrandWordmarkProps) => (
  <span
    className={clsx(
      'block font-semibold uppercase tracking-[0.32em] text-[#E5E7EB] [text-shadow:0_0_18px_rgba(148,163,184,0.08)]',
      className
    )}
  >
    CORTEXA
  </span>
);

export default BrandWordmark;
