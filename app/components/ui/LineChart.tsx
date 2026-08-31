/**
 * Multi-series line/area chart — sibling to BarChart.tsx and Sparkline.tsx, same
 * zero-dependency, server-renderable SVG approach (no chart library, no client JS;
 * hover values use native <title> tooltips).
 *
 * Supports two axis scales. Series flagged `axis: "right"` are normalized against their
 * own maximum and labelled on the right edge, which is what lets a units-sold line and a
 * revenue line — different units, wildly different magnitudes — share one plot and still
 * both have a readable shape.
 */
export interface LineSeries {
  label: string;
  /** One value per x-axis point; must be the same length as `labels`. */
  values: number[];
  /** CSS color, normally a palette token e.g. "var(--color-primary)". */
  color: string;
  /** Which scale to normalize against. Defaults to "left". */
  axis?: "left" | "right";
  /** Soft fill under the line. Best on a single-series chart. */
  area?: boolean;
  /** Renders dashed — used for the "prior period" comparison line. */
  dashed?: boolean;
  /** Formats values in the tooltip and axis maximum, e.g. (n) => `₱${n.toFixed(2)}`. */
  format?: (value: number) => string;
}

export interface LineChartProps {
  labels: string[];
  series: LineSeries[];
  width?: number;
  height?: number;
  className?: string;
  gridLines?: number;
  /** Show at most this many x-axis labels, thinning evenly. Keeps 90-day ranges legible. */
  maxXLabels?: number;
  /**
   * Where the series key sits. "left" stacks it vertically beside the plot, which reads
   * better when the labels are long (product or category names) — a horizontal key wraps
   * to three rows and pushes the chart down. Defaults to "top" so existing callers are
   * unaffected.
   */
  legendPosition?: "top" | "left";
  /**
   * Rotate the x-axis labels to vertical. Category axes carry names like "Frozen Longganisa
   * 500g"; horizontally they overlap into an unreadable smear well before the axis is full.
   * Vertical labels stay legible at any point count, at the cost of chart height.
   */
  verticalXLabels?: boolean;
}

export default function LineChart({
  labels,
  series,
  width = 640,
  height = 240,
  className,
  gridLines = 4,
  maxXLabels = 12,
  legendPosition = "top",
  verticalXLabels = false,
}: LineChartProps) {
  if (labels.length === 0 || series.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-text-muted"
      >
        No data for this period.
      </div>
    );
  }

  const paddingTop = 12;
  // Rotated labels need room proportional to the longest one, since they consume vertical
  // space rather than horizontal. Capped so one runaway name can't squash the plot.
  const longestLabel = labels.reduce((max, l) => Math.max(max, l.length), 0);
  const paddingBottom = verticalXLabels ? Math.min(120, 18 + longestLabel * 5.5) : 26;
  const paddingLeft = 8;
  const paddingRight = 8;
  const plotHeight = height - paddingTop - paddingBottom;
  const plotWidth = width - paddingLeft - paddingRight;

  const hasRightAxis = series.some((s) => s.axis === "right");
  // Each axis is scaled to the largest value across its own series, so a flat-but-nonzero
  // line still reads as flat rather than being blown up to fill the plot.
  const leftMax = Math.max(
    1,
    ...series.filter((s) => s.axis !== "right").flatMap((s) => s.values),
  );
  const rightMax = Math.max(
    1,
    ...series.filter((s) => s.axis === "right").flatMap((s) => s.values),
  );

  /**
   * The legend reports each series' OWN peak, not the axis ceiling it is drawn against.
   * Those coincide when a chart has one series per axis, which is why printing the axis
   * max here looked right for a long time — but with several series sharing an axis (one
   * line per customer, say) every entry showed the same number, which reads as a broken
   * calculation rather than as "this is the axis maximum".
   */
  const seriesMax = (s: LineSeries) => (s.values.length > 0 ? Math.max(...s.values) : 0);

  const stepX = labels.length > 1 ? plotWidth / (labels.length - 1) : 0;
  const x = (i: number) => paddingLeft + (labels.length > 1 ? i * stepX : plotWidth / 2);
  const y = (value: number, axis: "left" | "right") =>
    paddingTop + plotHeight - (value / (axis === "right" ? rightMax : leftMax)) * plotHeight;

  const gridYs = Array.from(
    { length: gridLines },
    (_, i) => paddingTop + (plotHeight / (gridLines - 1)) * i,
  );

  const labelStride = Math.max(1, Math.ceil(labels.length / maxXLabels));
  // Rotated labels don't compete for horizontal room, so every point can be labelled.
  const effectiveStride = verticalXLabels ? 1 : labelStride;
  const labelBaseline = height - paddingBottom + 8;

  const onLeft = legendPosition === "left";

  const legend = (
    <div
      className={
        onLeft
          ? "flex shrink-0 flex-col gap-1.5 sm:w-44"
          : "mb-2 flex flex-wrap items-center gap-x-4 gap-y-1"
      }
    >
      {series.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4 shrink-0 rounded-full"
            style={{
              backgroundColor: s.color,
              opacity: s.dashed ? 0.55 : 1,
            }}
          />
          <span className={onLeft ? "min-w-0 truncate" : undefined} title={onLeft ? s.label : undefined}>
            {s.label}
          </span>
          <span className="shrink-0 text-text-muted/70">
            (max {(s.format ?? String)(seriesMax(s))})
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div className={onLeft ? `flex flex-col gap-3 sm:flex-row sm:items-start ${className ?? ""}` : className}>
      {legend}
      <div className={onLeft ? "min-w-0 flex-1" : undefined}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`Line chart: ${series.map((s) => s.label).join(", ")}`}
      >
        {gridYs.map((gy) => (
          <line
            key={gy}
            x1={paddingLeft}
            y1={gy}
            x2={width - paddingRight}
            y2={gy}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        ))}

        {series.map((s) => {
          const axis = s.axis ?? "left";
          const points = s.values.map((v, i) => `${x(i).toFixed(2)},${y(v, axis).toFixed(2)}`);
          const baseline = paddingTop + plotHeight;

          return (
            <g key={s.label}>
              {s.area && s.values.length > 1 && (
                <polygon
                  points={`${x(0).toFixed(2)},${baseline} ${points.join(" ")} ${x(s.values.length - 1).toFixed(2)},${baseline}`}
                  fill={s.color}
                  opacity={0.12}
                />
              )}
              <polyline
                points={points.join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? "5 4" : undefined}
                opacity={s.dashed ? 0.65 : 1}
              />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v, axis)} r={7} fill="transparent">
                  <title>{`${labels[i]} — ${s.label}: ${(s.format ?? String)(v)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {labels.map((label, i) =>
          i % effectiveStride === 0 ? (
            <text
              key={`${label}-${i}`}
              x={x(i)}
              y={verticalXLabels ? labelBaseline : height - 8}
              textAnchor={
                verticalXLabels
                  ? "end"
                  : i === 0
                    ? "start"
                    : i === labels.length - 1
                      ? "end"
                      : "middle"
              }
              transform={verticalXLabels ? `rotate(-90 ${x(i)} ${labelBaseline})` : undefined}
              className="fill-text-muted text-[10px]"
            >
              {label}
            </text>
          ) : null,
        )}
      </svg>

      {hasRightAxis && (
        <p className="mt-1 text-right text-[10px] text-text-muted">
          Each series is scaled to its own maximum — compare shapes, not heights.
        </p>
      )}
      </div>
    </div>
  );
}
