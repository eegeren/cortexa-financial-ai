interface HeatmapCell {
  label: string;
  value: number;
}

interface HeatmapMatrixProps {
  rows: string[];
  cols: string[];
  data: Record<string, Record<string, HeatmapCell>>;
}

const scaleColor = (value: number) => {
  const clamped = Math.max(-1, Math.min(1, value));
  if (clamped >= 0) {
    const intensity = Math.round(60 + clamped * 120);
    return `rgba(34, 197, 94, ${intensity / 255})`;
  }
  const intensity = Math.round(60 + Math.abs(clamped) * 120);
  return `rgba(239, 68, 68, ${intensity / 255})`;
};

const HeatmapMatrix = ({ rows, cols, data }: HeatmapMatrixProps) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-xs">
      <thead>
        <tr className="text-slate-400">
          <th className="px-2 py-1" />
          {cols.map((col) => (
            <th key={col} className="px-2 py-1 text-right">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row} className="border-t border-slate-800/60">
            <td className="px-2 py-1 text-slate-400">{row}</td>
            {cols.map((col) => {
              const cell = data[row]?.[col];
              if (!cell) {
                return (
                  <td key={col} className="px-2 py-1 text-center text-slate-600">
                    --
                  </td>
                );
              }
              return (
                <td key={col} className="px-2 py-1 text-right">
                  <span
                    className="inline-block min-w-[48px] rounded-md px-2 py-1 text-xs text-white"
                    style={{ backgroundColor: scaleColor(cell.value) }}
                  >
                    {cell.label}
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default HeatmapMatrix;
