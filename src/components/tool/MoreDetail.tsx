import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface Props {
  title: string;
  /** One line on what is inside. */
  hint?: string;
  /** Start open: for the chart, which most visitors should see without asking. */
  defaultOpen?: boolean;
  children: ComponentChildren;
}

/**
 * A section for detail some visitors skip (the working, the monthly table), closed unless
 * `defaultOpen`. Its content renders only while open, so a long table costs nothing until wanted.
 */
export default function MoreDetail({ title, hint, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      class="group border-b border-line"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary class="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2.5 hover:text-accent-strong">
        <span>
          <span class="block font-display text-lg font-medium">{title}</span>
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
      {open && <div class="pb-5">{children}</div>}
    </details>
  );
}
