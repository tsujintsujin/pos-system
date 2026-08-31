/**
 * Single-series bar chart — moderate-width bars with rounded top corners, single hue
 * (primary token, darkening to primary-hover on :hover via pure CSS), recessive
 * (border-token, low-opacity) gridlines, x-axis labels. No dual-axis, no legend needed
 * for a single series. Value-on-hover uses a native <title> tooltip — no client JS.
 * Each bar shows its value above it; x-axis labels are truncated to 12 characters.
 * Plain server-renderable SVG, consistent with this codebase's zero-chart-dependency
 * pattern (see Sparkline.tsx).
 */
export interface BarChartDatum {
  /** X-axis label, e.g. a day-of-week abbreviation. */
  label: string;
  value: number;
  /** Full value for the hover tooltip, e.g. "₱1,234.00" — falls back to the raw value. */
  tooltip?: string;
  /** Formatted value shown on the bar itself, e.g. "₱1,234.00" — falls back to the raw value. */
  valueLabel?: string;
}

export interface BarChartProps {
  data: BarChartDatum[];
  width?: number;
  height?: number;
  className?: string;
  /** Number of horizontal gridlines (including the baseline). */
  gridLines?: number;
  /**
   * Rotate the x-axis labels to vertical. Category axes carry names like "Frozen Longganisa
   * 500g"; horizontally they overlap into an unreadable smear well before the axis is full.
   * Vertical labels stay legible at any bar count, at the cost of chart height.
   */
  verticalXLabels?: boolean;
}

export default function BarChart({
  data,
  width = 480,
  height = 220,
  className,
  gridLines = 4,
  verticalXLabels = false,
}: BarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  // Reserves room above the tallest bar for its value label, which sits above the bar
  // regardless of height — without this, the label for a max-height bar would have
  // nowhere to go but down into the bar itself.
  const paddingTop = 20;
  // Rotated labels need room proportional to the longest one, since they now consume
  // vertical space rather than horizontal. Capped so one runaway name can't squash the plot.
  // Labels are truncated to 12 characters for display, so the longest possible is 12.
  const longestLabel = Math.min(12, data.reduce((max, d) => Math.max(max, d.label.length), 0));
  const paddingBottom = verticalXLabels ? Math.min(120, 16 + longestLabel * 5.5) : 24;
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
              y={y - 4}
              textAnchor="middle"
              className="fill-text text-[9px]"
            >
              {d.valueLabel ?? d.value}
            </text>
            <text
              x={x + barWidth / 2}
              y={verticalXLabels ? paddingTop + plotHeight + 8 : height - 6}
              textAnchor={verticalXLabels ? "end" : "middle"}
              transform={
                verticalXLabels
                  ? `rotate(-90 ${x + barWidth / 2} ${paddingTop + plotHeight + 8})`
                  : undefined
              }
              className="fill-text-muted text-[10px]"
            >
              {d.label.slice(0, 12)}
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
