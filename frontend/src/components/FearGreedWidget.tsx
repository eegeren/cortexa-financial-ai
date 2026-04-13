import { motion } from 'framer-motion';
import clsx from 'clsx';

interface FearGreedWidgetProps {
  value: number;
  classification: string;
  compact?: boolean;
  className?: string;
}

const getGaugeColor = (value: number): string => {
  if (value <= 25) return '#ef4444';   // extreme fear - red
  if (value <= 50) return '#f97316';   // fear - orange
  if (value <= 55) return '#eab308';   // neutral - yellow
  if (value <= 75) return '#86efac';   // greed - light green
  return '#10b981';                    // extreme greed - emerald
};

const getSignalBadgeClass = (value: number): string => {
  if (value <= 25) return 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30';
  if (value <= 50) return 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30';
  if (value <= 55) return 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30';
  if (value <= 75) return 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25';
  return 'bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/40';
};

/**
 * SVG semicircle gauge. The arc spans 180 degrees (left to right).
 * value 0 = leftmost, value 100 = rightmost.
 */
const SemicircleGauge = ({ value, color, size = 180 }: { value: number; color: string; size?: number }) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeW = size * 0.07;
  const trackW = size * 0.055;

  // Arc helper: polar to cartesian (angle in degrees, 0 = left, 180 = right along the top semicircle)
  const polarToCartesian = (angleDeg: number) => {
    const rad = ((angleDeg - 180) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const start = polarToCartesian(0);
  const end = polarToCartesian(180);
  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;

  const needleAngle = value * 1.8; // 0–180 degrees
  const needle = polarToCartesian(needleAngle);
  const needlePath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${needle.x} ${needle.y}`;

  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox={`0 0 ${size} ${size * 0.6}`}
      className="overflow-visible"
      aria-hidden
    >
      {/* Track */}
      <path
        d={trackPath}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={trackW}
        strokeLinecap="round"
      />
      {/* Filled arc */}
      <motion.path
        d={needlePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      {/* Glow */}
      <motion.path
        d={needlePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeW * 2.5}
        strokeLinecap="round"
        opacity={0}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.18 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      {/* End dot */}
      <motion.circle
        cx={needle.x}
        cy={needle.y}
        r={strokeW * 0.7}
        fill={color}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, duration: 0.3 }}
      />
    </svg>
  );
};

const FearGreedWidget = ({ value, classification, compact = false, className }: FearGreedWidgetProps) => {
  const color = getGaugeColor(value);
  const badgeClass = getSignalBadgeClass(value);
  const gaugeSize = compact ? 120 : 180;

  if (compact) {
    return (
      <div className={clsx('flex items-center gap-3', className)}>
        <div className="relative flex items-end justify-center" style={{ width: gaugeSize, height: gaugeSize * 0.6 }}>
          <SemicircleGauge value={value} color={color} size={gaugeSize} />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <span className={clsx('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest', badgeClass)}>
            {classification}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: gaugeSize, height: gaugeSize * 0.6 }}>
        <SemicircleGauge value={value} color={color} size={gaugeSize} />
      </div>
      <motion.p
        className="text-5xl font-bold tracking-tight text-white"
        style={{ color }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {value}
      </motion.p>
      <motion.span
        className={clsx('rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest', badgeClass)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {classification}
      </motion.span>
      {/* Scale labels */}
      <div className="mt-1 flex w-full max-w-[180px] justify-between text-[9px] uppercase tracking-widest text-slate-600">
        <span>Extreme Fear</span>
        <span>Extreme Greed</span>
      </div>
    </div>
  );
};

export default FearGreedWidget;
