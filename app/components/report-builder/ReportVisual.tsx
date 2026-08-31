"use client";

/**
 * Report builder — visual renderer.
 *
 * Reshapes the result via lib/report-builder/shape.ts, then hands it to one of the POS's
 * existing chart primitives. The shaping is shared with the CSV export so a downloaded
 * file matches the chart it came from; this file only decides how a shape is *drawn*.
 *
 * Binding happens by *slot*, not by column position: the query layer tags every output
 * column with the slot that produced it, so nothing here has to guess which column is the
 * x axis. That is what makes switching visual type a no-op.
 *
 * Used in two places with the same props: the builder's live preview, and each published
 * card on the dashboard.
 */

import { useState } from "react";
import BarChart from "@/app/components/ui/BarChart";
import DonutChart from "@/app/components/ui/DonutChart";
import LineChart from "@/app/components/ui/LineChart";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableBody, TableHead, TableHeaderCell, TableRow } from "@/app/components/ui/Table";
import { shapeCategory, shapePivot, shapeScalar, shapeSeries } from "@/lib/report-builder/shape";
import type { ReportConfig, ReportResult, SortDirection } from "@/lib/report-builder/types";

/**
 * How many entries a visual shows before the reader asks for more. A chart with twenty
 * customer lines is a smear no matter how it is drawn; five is readable, and the rest are
 * one click away rather than gone.
 */
const DEFAULT_VISIBLE = 5;

const SERIES_COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-secondary)",
  "var(--color-danger)",
];

export function formatNumber(value: number, currency: boolean): string {
  const formatted = value.toLocaleString("en-PH", {
    minimumFractionDigits: currency ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return currency ? `₱${formatted}` : formatted;
}

export default function ReportVisual({
  config,
  result,
  height = 260,
  pending = false,
  sortDirection = "desc",
  expandedLimit,
}: {
  config: ReportConfig;
  result: ReportResult;
  height?: number;
  /** A newer query is in flight and `result` belongs to an older config. */
  pending?: boolean;
  /** Order for whatever this visual ranks. Descending by default: when only the first
   * few are shown, the largest are what someone means by "top". */
  sortDirection?: SortDirection;
  /**
   * Caps how many entries "show more" reveals — the builder's own live preview passes
   * this (a dataset can have dozens of groups, and the preview is for a fast read on
   * shape, not a full listing). Dashboard cards omit it, which swaps the "show all"
   * button for a number input so the viewer picks their own count.
   */
  expandedLimit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  // Dashboard-only: once the viewer opts to see more than the default, this holds how
  // many they asked for. Undefined until then, so the button/input swap only happens
  // on demand rather than on every card up front.
  const [customCount, setCustomCount] = useState<number | null>(null);

  // Never draw rows that were shaped by a different config — the slots wouldn't match and
  // the chart would be quietly wrong rather than obviously empty.
  if (pending && result.rows.length === 0) {
    return (
      <p style={{ minHeight: height }} className="flex items-center justify-center text-sm text-text-muted">
        Loading…
      </p>
    );
  }

  if (result.rows.length === 0) {
    return (
      <EmptyState
        message="No data for this selection."
        subMessage="Widen the dashboard's date range, or loosen a filter."
      />
    );
  }

  /**
   * The cap is applied *after* shaping, not to the raw rows. A series-split trend arrives
   * long — one row per x × series — so slicing rows would keep ten (date, category) pairs
   * and collapse the axis to a day or two. What needs limiting is what the axis draws:
   * bars, slices, x-axis points, pivot rows.
   */
  const withToggle = (total: number, chart: React.ReactNode) => {
    if (total <= DEFAULT_VISIBLE) return chart;

    // Builder preview: a plain toggle capped well below "all", since the preview is a
    // fast read on shape rather than a listing meant to be complete.
    if (expandedLimit !== undefined) {
      const expandedCount = Math.min(total, expandedLimit);
      return (
        <div className="flex flex-col">
          {chart}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 cursor-pointer self-start text-xs font-medium text-primary transition-colors duration-150 hover:text-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {expanded ? `Show first ${DEFAULT_VISIBLE}` : `Show up to ${expandedCount}`}
          </button>
        </div>
      );
    }

    // Dashboard card: "show all" becomes an input so the viewer names their own count
    // rather than getting an all-or-five choice.
    return (
      <div className="flex flex-col gap-2">
        {chart}
        {customCount === null ? (
          <button
            type="button"
            onClick={() => setCustomCount(total)}
            className="self-start text-xs font-medium text-primary transition-colors duration-150 hover:text-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Show all {total}
          </button>
        ) : (
          <label className="flex items-center gap-2 self-start text-xs text-text-muted">
            Show
            <input
              type="number"
              min={1}
              max={total}
              value={customCount}
              onChange={(e) => {
                const next = Number(e.target.value);
                setCustomCount(Number.isFinite(next) ? Math.min(total, Math.max(1, next)) : 1);
              }}
              className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-text tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            of {total}
          </label>
        )}
      </div>
    );
  };

  const cap = <T,>(items: T[]): T[] => {
    if (expandedLimit !== undefined) {
      return items.slice(0, expanded ? expandedLimit : DEFAULT_VISIBLE);
    }
    return items.slice(0, customCount ?? DEFAULT_VISIBLE);
  };

  // Sorting happens before capping, so "top 5" means the five that matter under the
  // current order rather than the five the query happened to return first.
  const direction = sortDirection === "asc" ? 1 : -1;
  const sortByValue = <T,>(items: T[], value: (item: T) => number): T[] =>
    [...items].sort((a, b) => (value(a) - value(b)) * direction);

  switch (config.visualType) {
    case "kpi": {
      const shape = shapeScalar(result);
      return (
        <div className="flex flex-col items-start gap-1 py-6">
          <p className="text-sm text-text-muted">
            {shape.label}
            {shape.aggregation ? ` · ${shape.aggregation}` : ""}
          </p>
          <p className="font-heading text-4xl font-semibold tracking-tight text-text">
            {formatNumber(shape.value, shape.currency)}
          </p>
          <p className="text-xs text-text-muted">Across every row in the selected range.</p>
        </div>
      );
    }

    case "bar": {
      const shape = shapeCategory(result, "xAxis");
      const items = sortByValue(shape.items, (i) => i.value);
      return withToggle(
        items.length,
        <BarChart
          data={cap(items).map((item) => ({
            label: item.label,
            value: item.value,
            tooltip: `${item.label} — ${formatNumber(item.value, shape.currency)}`,
            valueLabel: formatNumber(item.value, shape.currency),
          }))}
          height={height}
          verticalXLabels
        />,
      );
    }

    case "donut":
    case "pie": {
      const shape = shapeCategory(result, "category");
      const size = 200;
      const items = sortByValue(shape.items, (i) => i.value);
      return withToggle(
        items.length,
        <DonutChart
          data={cap(items).map((item) => ({
            label: item.label,
            // Negative slices can't read as a share of a whole; clamp rather than drop the
            // row, so the label still appears in the legend.
            value: Math.max(0, item.value),
          }))}
          size={size}
          // A pie is a donut with no hole — same geometry, one prop apart.
          thickness={config.visualType === "pie" ? size / 2 : 28}
          format={(n) => formatNumber(n, shape.currency)}
        />,
      );
    }

    case "line":
    case "area": {
      const shape = shapeSeries(result);
      // With a series split it is the number of lines that overwhelms the chart, so that
      // is what gets capped and the x axis stays whole. Without one there is a single line,
      // and the only thing worth limiting is how far along the axis it runs.
      const multiSeries = shape.series.length > 1;
      const sortedSeries = sortByValue(shape.series, (s) =>
        s.values.length > 0 ? Math.max(...s.values) : 0,
      );
      const visibleSeries = multiSeries ? cap(sortedSeries) : sortedSeries;
      const visibleLabels = multiSeries ? shape.labels : cap(shape.labels);
      return withToggle(
        multiSeries ? shape.series.length : shape.labels.length,
        <LineChart
          labels={visibleLabels}
          series={visibleSeries.map((s, i) => ({
            label: s.label,
            values: s.values.slice(0, visibleLabels.length),
            color: SERIES_COLORS[i % SERIES_COLORS.length],
            area: config.visualType === "area",
            format: (n: number) => formatNumber(n, shape.currency),
          }))}
          height={height}
          legendPosition="left"
          verticalXLabels
        />,
      );
    }

    case "pivot":
    default: {
      const shape = shapePivot(result);
      const pivotRows = sortByValue(shape.rows, (r) => r.total);
      return withToggle(
        pivotRows.length,
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{shape.rowHeader}</TableHeaderCell>
              {shape.columnHeaders.map((header) => (
                <TableHeaderCell key={header} className="text-right">
                  {header}
                </TableHeaderCell>
              ))}
              <TableHeaderCell className="text-right">Total</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cap(pivotRows).map((row) => (
              <TableRow key={row.label}>
                <td className="px-3 py-2 text-text">{row.label}</td>
                {row.cells.map((cell, i) => (
                  <td
                    key={shape.columnHeaders[i]}
                    className="px-3 py-2 text-right tabular-nums text-text-muted"
                  >
                    {cell == null ? "—" : formatNumber(cell, shape.currency)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-medium tabular-nums text-text">
                  {formatNumber(row.total, shape.currency)}
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>,
      );
    }
  }
}
