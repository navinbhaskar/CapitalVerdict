import type { ComponentChildren } from 'preact';

/** One line of "how the answer is worked out": a label, optional arithmetic, and the value. */
export interface WorkingRow {
  label: string;
  /** The calculation in plain symbols, with the user's numbers. */
  formula?: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
}

/** A titled table of working rows with an optional footnote, like one block of a spreadsheet. */
export default function WorkingBlock({
  title,
  rows,
  children,
}: {
  title: string;
  rows: WorkingRow[];
  children?: ComponentChildren;
}) {
  return (
    <div class="rounded-xl border border-line bg-raised">
      <h3 class="border-b border-line bg-surface px-4 py-2 text-sm font-semibold">{title}</h3>
      <dl class="divide-y divide-line px-4">
        {rows.map((row) => (
          <div key={row.label} class="flex items-baseline justify-between gap-4 py-2">
            <dt class="min-w-0">
              <span class={row.strong ? 'font-medium' : ''}>{row.label}</span>
              {row.formula && (
                <span class="mt-0.5 block text-xs text-ink-muted num">{row.formula}</span>
              )}
            </dt>
            <dd
              class={`shrink-0 text-right num ${row.strong ? 'text-base font-semibold' : ''} ${
                row.negative ? 'text-danger' : ''
              }`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {children && <p class="px-4 pb-3 text-sm text-ink-muted">{children}</p>}
    </div>
  );
}
