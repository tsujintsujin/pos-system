/**
 * Share-of-total donut — sibling to BarChart.tsx / LineChart.tsx, same zero-dependency
 * server-rendered SVG approach. Used where the question is "what proportion of the whole",
 * not "how did it change over time": revenue by category, payments by method.
 *
 * Slices below `otherThreshold` of the total are folded into a single "Other" slice so a
 * long tail of 1% categories doesn't turn the ring into confetti.
 */
export interface DonutSlice {
  label: string;
  value: number;
}

export interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  className?: string;
  /** Formats the legend and tooltip values, e.g. (n) => `₱${n.toFixed(2)}`. */
  format?: (value: number) => string;
  /** Big number in the middle of the ring. */
  centerLabel?: string;
  centerSubLabel?: string;
  /** Fraction of the total below which a slice is merged into "Other". */
  otherThreshold?: number;
}

/** Palette tokens, in the order slices are assigned. Never a hardcoded hex — see globals.css. */
const SLICE_COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-secondary)",
  "var(--color-danger)",
];
const OTHER_COLOR = "var(--color-border)";

export default function DonutChart({
  data,
  size = 200,
  thickness = 28,
  className,
  format = String,
  centerLabel,
  centerSubLabel,
  otherThreshold = 0.03,
}: DonutChartProps) {
  const positive = data.filter((d) => d.value > 0);
  const total = positive.reduce((sum, d) => sum + d.value, 0);

  if (total <= 0) {
    return (
      <div
        style={{ minHeight: size }}
        className="flex items-center justify-center text-sm text-text-muted"
      >
        No data for this period.
      </div>
    );
  }

  const sorted = [...positive].sort((a, b) => b.value - a.value);
  const major = sorted.filter((d) => d.value / total >= otherThreshold);
  const minorTotal = sorted
    .filter((d) => d.value / total < otherThreshold)
    .reduce((sum, d) => sum + d.value, 0);
  const slices = minorTotal > 0 ? [...major, { label: "Other", value: minorTotal }] : major;

  const radius = size / 2;
  const inner = radius - thickness;

  // Cumulative start/end angles are computed up front, in the render body, rather than by
  // mutating a running total inside the .map() below — that callback isn't guaranteed to
  // run once per render, so accumulating in it produces wrong arcs on a re-render.
  const arcs: { label: string; value: number; start: number; end: number; color: string }[] = [];
  let cursor = -Math.PI / 2; // start at 12 o'clock
  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    const sweep = (slice.value / total) * Math.PI * 2;
    arcs.push({
      label: slice.label,
      value: slice.value,
      start: cursor,
      end: cursor + sweep,
      color: slice.label === "Other" ? OTHER_COLOR : SLICE_COLORS[i % SLICE_COLORS.length],
    });
    cursor += sweep;
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-5">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="shrink-0"
          role="img"
          aria-label="Donut chart"
        >
          {arcs.map((arc) => (
            <path
              key={arc.label}
              d={arcPath(radius, radius, radius, inner, arc.start, arc.end)}
              fill={arc.color}
            >
              <title>{`${arc.label}: ${format(arc.value)} (${((arc.value / total) * 100).toFixed(1)}%)`}</title>
            </path>
          ))}
          {centerLabel && (
            <text
              x={radius}
              y={centerSubLabel ? radius - 2 : radius + 4}
              textAnchor="middle"
              className="fill-text text-[15px] font-semibold"
            >
              {centerLabel}
            </text>
          )}
          {centerSubLabel && (
            <text x={radius} y={radius + 14} textAnchor="middle" className="fill-text-muted text-[10px]">
              {centerSubLabel}
            </text>
          )}
        </svg>

        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {arcs.map((arc) => (
            <li key={arc.label} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: arc.color }}
              />
              <span className="min-w-0 flex-1 truncate text-text-muted">{arc.label}</span>
              <span className="shrink-0 font-medium text-text">{format(arc.value)}</span>
              <span className="w-11 shrink-0 text-right text-xs text-text-muted">
                {((arc.value / total) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Donut segment: outer arc from `start` to `end`, back along the inner arc, closed. */
function arcPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number,
): string {
  // A full circle can't be drawn as a single arc (start and end points coincide), so
  // nudge it just short of 360° — visually identical, and keeps the path valid.
  const sweep = Math.min(end - start, Math.PI * 2 - 0.0001);
  const stop = start + sweep;
  const largeArc = sweep > Math.PI ? 1 : 0;

  const ox1 = cx + outer * Math.cos(start);
  const oy1 = cy + outer * Math.sin(start);
  const ox2 = cx + outer * Math.cos(stop);
  const oy2 = cy + outer * Math.sin(stop);
  const ix1 = cx + inner * Math.cos(stop);
  const iy1 = cy + inner * Math.sin(stop);
  const ix2 = cx + inner * Math.cos(start);
  const iy2 = cy + inner * Math.sin(start);

  return [
    `M${ox1.toFixed(2)},${oy1.toFixed(2)}`,
    `A${outer},${outer} 0 ${largeArc} 1 ${ox2.toFixed(2)},${oy2.toFixed(2)}`,
    `L${ix1.toFixed(2)},${iy1.toFixed(2)}`,
    `A${inner},${inner} 0 ${largeArc} 0 ${ix2.toFixed(2)},${iy2.toFixed(2)}`,
    "Z",
  ].join(" ");
}
