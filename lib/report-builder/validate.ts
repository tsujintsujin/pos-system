/**
 * Report builder — validation.
 *
 * Split into errors (the config cannot be queried) and warnings (it can, but the result
 * will probably mislead). The distinction matters for the live preview: errors suppress
 * the query entirely, warnings render alongside a real result.
 *
 * Errors name what is missing and stop there. An earlier version also nominated a
 * replacement visual ("show it as bars instead"), but guessing at intent mid-build is
 * noise — the visual type is one click away in the panel above.
 */

import { DATASET_RANGE_FIELD, getDataset, getField, getVisual } from "./catalog";
import { VALUELESS_OPERATORS, type ReportConfig } from "./types";

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function validateConfig(config: ReportConfig): ValidationResult {
  const issues: ValidationIssue[] = [];
  const dataset = getDataset(config.datasetId);
  const visual = getVisual(config.visualType);

  if (!dataset) {
    return { valid: false, issues: [{ level: "error", message: "Unknown data source." }] };
  }
  if (!visual) {
    return { valid: false, issues: [{ level: "error", message: "Unknown visual type." }] };
  }

  if (!config.name.trim()) {
    issues.push({ level: "error", message: "Give the visual a name before publishing it." });
  }

  for (const slot of visual.slots) {
    if (slot.required && !config.slots[slot.name]) {
      issues.push({ level: "error", message: `${visual.label} needs a field in “${slot.label}”.` });
    }
  }

  const usedFields = visual.slots
    .map((slot) => config.slots[slot.name])
    .filter((id): id is string => Boolean(id))
    .map((id) => getField(dataset, id));

  for (const field of usedFields) {
    if (!field || field.role !== "metric") continue;
    const agg = config.aggregations[field.id];
    if (!agg || !(field.aggregations ?? []).includes(agg)) {
      issues.push({ level: "error", message: `“${field.label}” needs a valid aggregation.` });
    }
  }

  for (const filter of config.filters) {
    const field = getField(dataset, filter.field);
    if (!field) {
      issues.push({ level: "error", message: "A filter points at a field this data doesn't have." });
      continue;
    }
    if (VALUELESS_OPERATORS.has(filter.operator)) continue;
    if (!filter.value.trim()) {
      issues.push({ level: "error", message: `Filter on “${field.label}” needs a value.` });
    }
    if (field.role === "metric") {
      issues.push({
        level: "warning",
        message: `“${field.label}” is filtered on raw row values, before aggregation.`,
      });
    }
  }

  // Warnings — shape problems that still produce a chart.
  const xAxisField = config.slots.xAxis ? getField(dataset, config.slots.xAxis) : undefined;
  if ((config.visualType === "line" || config.visualType === "area") && xAxisField && xAxisField.role !== "date") {
    issues.push({
      level: "warning",
      message: "A trend line implies order. A bar graph usually reads better for a non-date axis.",
    });
  }

  if (DATASET_RANGE_FIELD[dataset.id] === null) {
    issues.push({
      level: "warning",
      message: `${dataset.label} is a live snapshot, so the dashboard's date filter won't narrow it.`,
    });
  }

  return { valid: !issues.some((i) => i.level === "error"), issues };
}
