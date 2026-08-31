"use client";

import { useRouter } from "next/navigation";
import Input from "@/app/components/ui/Input";
import { cn } from "@/lib/cn";

/**
 * Dashboard date-range filter.
 *
 * Two mutually exclusive modes, never both: a **preset** (Today / Last 7 days / This
 * month) or a **custom** From–To range. They are separate query params — `?range=` or
 * `?from=&to=` — so the URL states which mode is in force rather than leaving it to be
 * inferred from values that happen to line up. Picking a preset drops the dates; picking
 * a date drops the preset. Whichever is live is highlighted, and the other is dimmed.
 *
 * Navigation-driven rather than state-driven: the range lives in the URL, which keeps the
 * server component the single source of truth, makes a view shareable, and lets Back step
 * through ranges the way people expect.
 */

export type DatePreset = "today" | "week" | "month";

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "This month" },
];

/**
 * Native date inputs only open their calendar from the small icon, which is a tiny target
 * and not where people click. `showPicker()` opens it from anywhere in the field. It
 * throws unless called from a user gesture and doesn't exist in every browser, so both
 * cases fall through to the normal typing behaviour.
 *
 * Bound to click only, not focus: firing on focus opens the calendar when you merely tab
 * into the field, which traps keyboard users who wanted to type the date instead.
 */
function openPicker(el: HTMLInputElement) {
  try {
    el.showPicker?.();
  } catch {
    // Not a trusted gesture, or unsupported — the field still accepts typed input.
  }
}

export default function DashboardDateFilter({
  activePreset,
  fromValue,
  toValue,
}: {
  /** The live preset, or null when a custom From–To range is in force. */
  activePreset: DatePreset | null;
  fromValue: string;
  toValue: string;
}) {
  const router = useRouter();
  const usingCustom = activePreset === null;

  const applyPreset = (key: DatePreset) => router.push(`/dashboard?range=${key}`);
  const applyCustom = (from: string, to: string) =>
    router.push(`/dashboard?from=${from}&to=${to}`);

  const dateFieldClass = cn(
    "w-40 cursor-pointer",
    // Dimmed while a preset is driving the dashboard, so it's obvious these dates aren't
    // what's being applied — they still show the resolved range, which is useful context.
    usingCustom ? "border-primary ring-1 ring-primary/30" : "opacity-60",
  );

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1">
          <span
            className={cn(
              "text-xs font-medium",
              usingCustom ? "text-primary" : "text-text-muted",
            )}
          >
            From
          </span>
          <Input
            type="date"
            aria-label="Date range from"
            value={fromValue}
            max={toValue || undefined}
            onClick={(e) => openPicker(e.currentTarget)}
            onChange={(e) => e.target.value && applyCustom(e.target.value, toValue)}
            className={dateFieldClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span
            className={cn(
              "text-xs font-medium",
              usingCustom ? "text-primary" : "text-text-muted",
            )}
          >
            To
          </span>
          <Input
            type="date"
            aria-label="Date range to"
            value={toValue}
            min={fromValue || undefined}
            onClick={(e) => openPicker(e.currentTarget)}
            onChange={(e) => e.target.value && applyCustom(fromValue, e.target.value)}
            className={dateFieldClass}
          />
        </label>
      </div>

      <div
        role="group"
        aria-label="Date range presets"
        className={cn(
          "inline-flex items-center gap-1 rounded-md border bg-surface p-1 transition-opacity duration-150",
          usingCustom ? "border-border opacity-60" : "border-primary",
        )}
      >
        {PRESETS.map((preset) => {
          const isActive = preset.key === activePreset;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.key)}
              aria-pressed={isActive}
              className={cn(
                "inline-flex min-h-9 cursor-pointer items-center rounded px-3 text-sm font-medium transition-colors duration-150",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                isActive ? "bg-primary text-white" : "text-text-muted hover:bg-bg hover:text-text",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
