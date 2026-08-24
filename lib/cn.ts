/** Tiny classname joiner — avoids adding a `clsx`/`tailwind-merge` dependency for this. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
