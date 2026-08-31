"use client";

import { shapeCategory, shapePivot, shapeScalar, shapeSeries } from "./shape";
import type { ReportConfig, ReportResult } from "./types";

/**
 * Client-side CSV export for a rendered visual.
 *
 * The file mirrors the visual, not the query. A pivot exports as a matrix with its Total
 * column; a multi-series line exports wide, one column per series; a donut exports its
 * slices with the share percentages its legend shows. Both the chart and this file read
 * the same functions in shape.ts, so a downloaded CSV can't disagree with the picture
 * above it.
 *
 * Deliberately not reusing `lib/csv.ts`: that module is marked `server-only` (it exports a
 * `Response` builder for the report download routes), and importing it from a client
 * component is a build error. The escaping rule is the same one, kept short enough that
 * restating it beats loosening the server boundary.
 */

type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const toCsv = (rows: Cell[][]): string => rows.map((r) => r.map(escapeCell).join(",")).join("\n");

/** Plain numbers, not "₱1,234.00" — a currency symbol and thousands separators turn a
 * spreadsheet column into text. Formatting is a screen concern. */
const num = (value: number | null | undefined): Cell =>
  value === null || value === undefined ? "" : Math.round(value * 100) / 100;

export function resultToCsv(config: ReportConfig, result: ReportResult): string {
  switch (config.visualType) {
    case "kpi": {
      const shape = shapeScalar(result);
      return toCsv([
        [shape.label, "Aggregation"],
        [num(shape.value), shape.aggregation ?? ""],
      ]);
    }

    case "pivot": {
      const shape = shapePivot(result);
      return toCsv([
        [shape.rowHeader, ...shape.columnHeaders, "Total"],
        ...shape.rows.map((row) => [row.label, ...row.cells.map(num), num(row.total)]),
      ]);
    }

    case "line":
    case "area": {
      const shape = shapeSeries(result);
      return toCsv([
        [shape.xHeader, ...shape.series.map((s) => s.label)],
        ...shape.labels.map((label, i) => [label, ...shape.series.map((s) => num(s.values[i]))]),
      ]);
    }

    case "donut":
    case "pie": {
      const shape = shapeCategory(result, "category");
      return toCsv([
        [shape.categoryHeader, shape.valueHeader, "Share %"],
        ...shape.items.map((item) => [
          item.label,
          num(item.value),
          Math.round(item.share * 1000) / 10,
        ]),
      ]);
    }

    case "bar":
    default: {
      const shape = shapeCategory(result, "xAxis");
      return toCsv([
        [shape.categoryHeader, shape.valueHeader],
        ...shape.items.map((item) => [item.label, num(item.value)]),
      ]);
    }
  }
}

/** Filesystem-safe slug for the download name, derived from the visual's own title. */
function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "visual";
}

/**
 * Trigger a download of the visual as CSV. Uses an object URL rather than a data: URI so a
 * large result isn't capped by URL length, and revokes it once the click is dispatched.
 */
export function downloadResultCsv(
  name: string,
  config: ReportConfig,
  result: ReportResult,
): void {
  if (typeof document === "undefined") return;

  const blob = new Blob([resultToCsv(config, result)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(name)}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
