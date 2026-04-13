import { useMemo } from 'react';

interface TrendChartProps {
  values: number[];
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
}

const TrendChart = ({ values, height = 60, positiveColor = '#22c55e', negativeColor = '#ef4444' }: TrendChartProps) => {
  const path = useMemo(() => {
    if (!values.length) {
      return '';
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = 100 / Math.max(values.length - 1, 1);
    const points = values
      .map((value, index) => {
        const x = index * step;
        const y = 100 - ((value - min) / span) * 100;
        return `${x},${y}`;
      })
      .join(' ');
    return `M0,100 L ${points} L100,100 Z`;
  }, [values]);

  const strokePath = useMemo(() => {
    if (!values.length) {
      return '';
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = 100 / Math.max(values.length - 1, 1);
    return values
      .map((value, index) => {
        const x = index * step;
        const y = 100 - ((value - min) / span) * 100;
        return `${index === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  }, [values]);

  if (!values.length) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        No data
      </div>
    );
  }

  const positive = values[values.length - 1] >= values[0];

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} className="w-full">
      <path d={path} fill={positive ? `${positiveColor}33` : `${negativeColor}33`} stroke="none" />
      <path d={strokePath} fill="none" stroke={positive ? positiveColor : negativeColor} strokeWidth={2} />
    </svg>
  );
};

export default TrendChart;
