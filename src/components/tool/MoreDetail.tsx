import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface Props {
  title: string;
  /** One line on what is inside. */
  hint?: string;
  children: ComponentChildren;
}

/**
 * A closed section for detail most visitors skip (the working, the chart, the monthly table).
 * Its content renders only once opened, so a chart or a long table costs nothing until wanted.
 */
export default function MoreDetail({ title, hint, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <details
      class="group border-b border-line"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 hover:text-accent-strong">
        <span>
          <span class="block font-display text-lg font-semibold">{title}</span>
          {hint && <span class="mt-0.5 block text-sm text-ink-muted">{hint}</span>}
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          class="shrink-0 text-ink-muted transition-transform duration-(--duration-base) ease-out-quart group-open:rotate-180"
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </summary>
      {open && <div class="pb-6">{children}</div>}
    </details>
  );
}
