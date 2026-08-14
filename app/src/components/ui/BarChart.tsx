export interface BarChartDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarChartDatum[];
  height?: number;
  formatValue?: (value: number) => string;
}

/**
 * Hand-rolled, dependency-free SVG bar chart. Bars in brand teal, gridline
 * in stone-200 — matches the DS token palette exactly instead of pulling in
 * a charting library for what the spec calls a "simple" chart.
 */
export function BarChart({ data, height = 220, formatValue = (v) => `${Math.round(v)}%` }: BarChartProps) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const barWidth = 56;
  const gap = 32;
  const width = data.length * barWidth + (data.length - 1) * gap;
  const labelSpace = 28;

  return (
    <div className="ui-barchart">
      <svg
        viewBox={`0 0 ${width} ${height + labelSpace + 40}`}
        width="100%"
        height={height + labelSpace + 40}
        role="img"
        aria-label="Brutomarge per evenement"
      >
        <line x1={0} y1={height + labelSpace} x2={width} y2={height + labelSpace} stroke="var(--nbc-stone-200)" strokeWidth={1} />
        {data.map((d, i) => {
          const barHeight = Math.max(2, (Math.abs(d.value) / max) * (height - 8));
          const x = i * (barWidth + gap);
          const y = labelSpace + (height - barHeight);
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx={6} fill="var(--nbc-blue)" />
              <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fontSize={13} fill="var(--fg-primary)" fontFamily="var(--font-body)">
                {formatValue(d.value)}
              </text>
              <text
                x={x + barWidth / 2}
                y={height + labelSpace + 20}
                textAnchor="middle"
                fontSize={12}
                fill="var(--fg-secondary)"
                fontFamily="var(--font-body)"
              >
                {d.label.length > 12 ? `${d.label.slice(0, 11)}…` : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
