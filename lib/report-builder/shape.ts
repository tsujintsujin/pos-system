"use client";

import type { ReportColumn, ReportResult, ReportRow, SlotName } from "./types";

/**
 * Report builder — result shaping.
 *
 * The query layer returns rows in long format: one row per group, one column per bound
 * slot. Every visual then reshapes that into what it actually draws — a pivot matrix, a
 * set of wide series, a ranked list of slices.
 *
 * That reshaping lives here rather than inside the renderer because two things consume it:
 * the chart on screen and the CSV export. Duplicating the logic guarantees they drift, and
 * an export that disagrees with the chart above it is worse than no export.
 *
 * Row ordering is preserved exactly as the query returned it — the SQL already sorted by
 * dimension (chronological for a date axis) or by value (for share visuals), so re-sorting
 * here would quietly undo that.
 */

export const columnFor = (columns: ReportColumn[], slot: SlotName) =>
  columns.find((c) => c.slot === slot);

export const numericAt = (row: ReportRow, alias: string | undefined): number =>
  alias && typeof row[alias] === "number" ? (row[alias] as number) : 0;

export const textAt = (row: ReportRow, alias: string | undefined): string =>
  alias ? String(row[alias] ?? "—") : "—";

/** A pivot matrix: one row per row-dimension value, one column per column-dimension value. */
export interface PivotShape {
  rowHeader: string;
  columnHeaders: string[];
  rows: { label: string; cells: (number | null)[]; total: number }[];
  currency: boolean;
}

export function shapePivot(result: ReportResult): PivotShape {
  const rowColumn = columnFor(result.columns, "rows");
  const colColumn = columnFor(result.columns, "columns");
  const valueColumn = columnFor(result.columns, "value");

  const rowKeys: string[] = [];
  for (const row of result.rows) {
    const key = textAt(row, rowColumn?.alias);
    if (!rowKeys.includes(key)) rowKeys.push(key);
  }
  const columnHeaders = Array.from(
    new Set(result.rows.map((r) => textAt(r, colColumn?.alias))),
  ).sort();

  const cellIndex = new Map(
    result.rows.map((r) => [
      `${textAt(r, rowColumn?.alias)}||${textAt(r, colColumn?.alias)}`,
      numericAt(r, valueColumn?.alias),
    ]),
  );

  return {
    rowHeader: rowColumn?.label ?? "Rows",
    columnHeaders,
    rows: rowKeys.map((label) => {
      const cells = columnHeaders.map((col) => cellIndex.get(`${label}||${col}`) ?? null);
      return {
        label,
        cells,
        total: cells.reduce<number>((sum, v) => sum + (v ?? 0), 0),
      };
    }),
    currency: valueColumn?.currency ?? false,
  };
}

/** Wide series for the trend visuals: shared x labels, one value array per series. */
export interface SeriesShape {
  xHeader: string;
  labels: string[];
  series: { label: string; values: number[] }[];
  currency: boolean;
}

export function shapeSeries(result: ReportResult): SeriesShape {
  const xColumn = columnFor(result.columns, "xAxis");
  const valueColumn = columnFor(result.columns, "value");
  const seriesColumn = columnFor(result.columns, "series");

  const labels = Array.from(new Set(result.rows.map((r) => textAt(r, xColumn?.alias))));
  const seriesKeys = seriesColumn
    ? Array.from(new Set(result.rows.map((r) => textAt(r, seriesColumn.alias)))).sort()
    : [valueColumn?.label ?? "Value"];

  return {
    xHeader: xColumn?.label ?? "Label",
    labels,
    series: seriesKeys.map((key) => ({
      label: key,
      values: labels.map((label) => {
        const match = result.rows.find(
          (r) =>
            textAt(r, xColumn?.alias) === label &&
            (!seriesColumn || textAt(r, seriesColumn.alias) === key),
        );
        return match ? numericAt(match, valueColumn?.alias) : 0;
      }),
    })),
    currency: valueColumn?.currency ?? false,
  };
}

/** A ranked list of categories, with each one's share of the total. */
export interface CategoryShape {
  categoryHeader: string;
  valueHeader: string;
  items: { label: string; value: number; share: number }[];
  currency: boolean;
}

/**
 * `slot` differs by visual — bars bind their label to `xAxis`, donuts and pies to
 * `category` — so the caller says which one carries the label.
 */
export function shapeCategory(result: ReportResult, labelSlot: SlotName): CategoryShape {
  const labelColumn = columnFor(result.columns, labelSlot);
  const valueColumn = columnFor(result.columns, "value");

  const items = result.rows.map((r) => ({
    label: textAt(r, labelColumn?.alias),
    value: numericAt(r, valueColumn?.alias),
  }));

  // Shares are computed over positive values only, matching how a donut reads: a negative
  // slice has no meaningful share of a whole.
  const total = items.reduce((sum, i) => sum + Math.max(0, i.value), 0);

  return {
    categoryHeader: labelColumn?.label ?? "Category",
    valueHeader: valueColumn?.label ?? "Value",
    items: items.map((i) => ({
      ...i,
      share: total > 0 ? Math.max(0, i.value) / total : 0,
    })),
    currency: valueColumn?.currency ?? false,
  };
}

/** A KPI reduces to one number — there is no dimension, so there is nothing to lay out. */
export interface ScalarShape {
  label: string;
  value: number;
  aggregation?: string;
  currency: boolean;
}

export function shapeScalar(result: ReportResult): ScalarShape {
  const valueColumn = columnFor(result.columns, "value");
  return {
    label: valueColumn?.label ?? "Value",
    value: result.rows[0] ? numericAt(result.rows[0], valueColumn?.alias) : 0,
    aggregation: valueColumn?.aggregation,
    currency: valueColumn?.currency ?? false,
  };
}
