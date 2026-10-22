export interface CompareItem {
  label: string;
  /** What you keep, after any tax. */
  value: number;
  /** The value as text, e.g. "₹28.97 lakh". */
  display: string;
  /** The side that comes out better: drawn in brass. */
  best?: boolean;
  /** Tax already taken off `value`, drawn as a lighter end to the bar. */
  tax?: number;
  /** One line under the bar, e.g. what the tax was or "Tax-free". */
  note?: string;
}

interface Props {
  /** What the bars measure, e.g. "Total cost over 10 years". */
  caption: string;
  items: CompareItem[];
}

/**
 * The two (or three) sides of a decision as bars on one scale, so the gap is visible at a glance.
 * Where tax applies, each bar is drawn at its value before tax, with the tax shaded lighter at the
 * end, so an option that grows more but loses more to tax reads honestly. The amounts are written
 * out; the bars only repeat them, so they are hidden from screen readers.
 */
export default function CompareBars({ caption, items }: Props) {
  const gross = (i: CompareItem) => Math.max(0, i.value) + Math.max(0, i.tax ?? 0);
  const max = Math.max(...items.map(gross), 1);
  return (
    <figure class="mt-4 border-t border-line pt-4">
      <figcaption class="text-sm text-ink-muted">{caption}</figcaption>
      <ul class="mt-2.5 space-y-3" role="list">
        {items.map((item) => {
          const kept = Math.max(0, item.value) / max;
          const tax = Math.max(0, item.tax ?? 0) / max;
          const fill = item.best ? 'bg-accent' : 'bg-ink-subtle';
          return (
            <li key={item.label}>
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <span class={item.best ? 'font-medium text-ink' : 'text-ink-muted'}>
                  {item.label}
                </span>
                <span
                  class={`font-display text-lg font-medium num ${item.best ? 'text-accent-strong' : 'text-ink'}`}
                >
                  {item.display}
                </span>
              </div>
              <div
                class="relative mt-1 h-2 overflow-hidden rounded-full bg-line"
                aria-hidden="true"
              >
                {tax > 0 && (
                  <div
                    class={`compare-bar absolute inset-0 origin-left rounded-full opacity-35 ${fill}`}
                    style={{ transform: `scaleX(${kept + tax})` }}
                  />
                )}
                <div
                  class={`compare-bar absolute inset-0 origin-left rounded-full ${fill}`}
                  style={{ transform: `scaleX(${kept})` }}
                />
              </div>
              {item.note && <p class="mt-1 text-xs text-ink-muted">{item.note}</p>}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
