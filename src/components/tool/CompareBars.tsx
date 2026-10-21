export interface CompareItem {
  label: string;
  value: number;
  /** The value as text, e.g. "₹28.97 lakh". */
  display: string;
  /** The side that comes out better: drawn in brass. */
  best?: boolean;
}

interface Props {
  /** What the bars measure, e.g. "Total cost over 10 years". */
  caption: string;
  items: CompareItem[];
}

/**
 * The two (or three) sides of a decision as bars on one scale, so the gap is visible at a glance.
 * The amounts are written out; the bars only repeat them, so they are hidden from screen readers.
 */
export default function CompareBars({ caption, items }: Props) {
  const max = Math.max(...items.map((i) => Math.max(0, i.value)), 1);
  return (
    <figure class="mt-4 border-t border-line pt-4">
      <figcaption class="text-sm text-ink-muted">{caption}</figcaption>
      <ul class="mt-2.5 space-y-3" role="list">
        {items.map((item) => (
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
            <div class="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div
                class={`compare-bar h-full origin-left rounded-full ${item.best ? 'bg-accent' : 'bg-ink-subtle'}`}
                style={{ transform: `scaleX(${Math.max(0, item.value) / max})` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}
