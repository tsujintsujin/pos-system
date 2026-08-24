/**
 * Tiny inline trend line for stat cards — single hue (primary token), no axes/gridlines/
 * labels, just the trend shape. Plain server-renderable SVG, no client JS needed.
 */
export interface SparklineProps {
  /** Chronological series, e.g. last 7 days of a metric. Needs at least 2 points to draw a line. */
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

export default function Sparkline({ values, width = 72, height = 28, className }: SparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const pad = 2;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
