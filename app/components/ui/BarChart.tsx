/**
 * Single-series bar chart — moderate-width bars with rounded top corners, single hue
 * (primary token, darkening to primary-hover on :hover via pure CSS), recessive
 * (border-token, low-opacity) gridlines, x-axis labels. No dual-axis, no legend needed
 * for a single series. Value-on-hover uses a native <title> tooltip — no client JS.
 * Plain server-renderable SVG, consistent with this codebase's zero-chart-dependency
 * pattern (see Sparkline.tsx).
 */
export interface BarChartDatum {
  /** X-axis label, e.g. a day-of-week abbreviation. */
  label: string;
  value: number;
  /** Full value for the hover tooltip, e.g. "₱1,234.00" — falls back to the raw value. */
  tooltip?: string;
}

export interface BarChartProps {
  data: BarChartDatum[];
  width?: number;
  height?: number;
  className?: string;
  /** Number of horizontal gridlines (including the baseline). */
  gridLines?: number;
}

export default function BarChart({
  data,
  width = 480,
  height = 220,
  className,
  gridLines = 4,
}: BarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const paddingTop = 10;
  const paddingBottom = 24;
  const paddingX = 8;
  const plotHeight = height - paddingTop - paddingBottom;
  const plotWidth = width - paddingX * 2;
  const slot = plotWidth / data.length;
  const barWidth = Math.min(40, slot * 0.5);
  const radius = Math.min(6, barWidth / 2);

  const gridYs = Array.from({ length: gridLines }, (_, i) => paddingTop + (plotHeight / (gridLines - 1)) * i);

  if (data.length === 0) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-sm text-text-muted"
      >
        No data for this period.
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      className={className}
      role="img"
      aria-label="Bar chart"
    >
      {gridYs.map((y) => (
        <line
          key={y}
          x1={paddingX}
          y1={y}
          x2={width - paddingX}
          y2={y}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
      ))}

      {data.map((d, i) => {
        const barHeight = maxValue > 0 ? (d.value / maxValue) * plotHeight : 0;
        const x = paddingX + slot * i + (slot - barWidth) / 2;
        const y = paddingTop + plotHeight - barHeight;
        const effectiveRadius = Math.min(radius, barHeight);

        return (
          <g key={d.label + i}>
            <path
              d={roundedTopBarPath(x, y, barWidth, barHeight, effectiveRadius)}
              className="cursor-pointer fill-primary transition-colors duration-200 hover:fill-primary-hover"
            >
              <title>{`${d.label}: ${d.tooltip ?? d.value}`}</title>
            </path>
            <text
              x={x + barWidth / 2}
              y={height - 6}
              textAnchor="middle"
              className="fill-text-muted text-[10px]"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** SVG path for a bar with only its top two corners rounded. */
function roundedTopBarPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  if (h < r) return `M${x},${y + h} L${x},${y + h} L${x + w},${y + h} L${x + w},${y + h} Z`;

  return [
    `M${x},${y + h}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + w - r},${y}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `L${x + w},${y + h}`,
    "Z",
  ].join(" ");
}
