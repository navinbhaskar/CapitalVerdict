import { useState } from 'preact/hooks';
import { t, type Locale } from '@/i18n/t';
import { formatINR } from '@/lib/format';
import { formatNumber } from '@/lib/formatTool';

export interface MonthlyColumn {
  label: string;
  /** Index 0 = month 1. */
  values: number[];
  kind: 'money' | 'price' | 'count';
}

interface Props {
  locale: Locale;
  columns: MonthlyColumn[];
  /** Months to highlight as break-even rows (1-based). */
  highlight: number[];
  csvFilename: string;
}

const cell = (value: number, kind: MonthlyColumn['kind']) =>
  kind === 'money'
    ? formatINR(value)
    : kind === 'price'
      ? formatNumber(value, 2)
      : formatNumber(value);

function toCsv(locale: Locale, columns: MonthlyColumn[]): string {
  const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = [t(locale, 'monthly.col.month'), ...columns.map((c) => c.label)].map(quote);
  const rows = columns[0]!.values.map((_, i) =>
    [String(i + 1), ...columns.map((c) => c.values[i]!.toFixed(2))].join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

/** Byte-order mark so Excel opens the CSV as UTF-8 (₹ and Hindi headers). */
const BOM = String.fromCharCode(0xfeff);

/** The full monthly model, like a spreadsheet's working sheet. Rows render only when opened. */
export default function MonthlyTable({ locale, columns, highlight, csvFilename }: Props) {
  const [open, setOpen] = useState(false);
  const months = columns[0]?.values.length ?? 0;

  const download = () => {
    const blob = new Blob([BOM + toCsv(locale, columns)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFilename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section aria-labelledby="monthly-heading">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="monthly-heading" class="font-display text-xl font-medium">
          {t(locale, 'monthly.heading')}
        </h2>
        <button type="button" onClick={download} class="btn btn-outline">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 4v11m-5-5 5 5 5-5M5 20h14"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {t(locale, 'monthly.download')}
        </button>
      </div>

      <details class="mt-3" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary class="inline-flex min-h-11 cursor-pointer items-center font-medium text-accent-strong">
          {t(locale, 'monthly.show', { n: months })}
        </summary>
        {open && (
          <div class="mt-3 max-h-136 overflow-auto rounded-xl border border-line">
            <table class="w-full min-w-256 border-collapse text-right text-sm num">
              <thead class="sticky top-0 z-10 bg-surface text-ink-muted">
                <tr>
                  <th scope="col" class="border-b border-line px-3 py-2.5 text-left font-medium">
                    {t(locale, 'monthly.col.month')}
                  </th>
                  {columns.map((c) => (
                    <th
                      key={c.label}
                      scope="col"
                      class="border-b border-line px-3 py-2.5 font-medium"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columns[0]!.values.map((_, i) => {
                  const month = i + 1;
                  const marked = highlight.includes(month);
                  return (
                    <tr
                      key={month}
                      class={`border-b border-line ${marked ? 'bg-accent-soft font-medium' : month % 12 === 0 ? 'bg-surface/60' : ''}`}
                    >
                      <th scope="row" class="px-3 py-2 text-left font-normal">
                        {month}
                        {marked && (
                          <span class="ml-2 text-xs text-accent-strong">
                            {t(locale, 'monthly.breakevenRow')}
                          </span>
                        )}
                      </th>
                      {columns.map((c) => {
                        const v = c.values[i]!;
                        return (
                          <td
                            key={c.label}
                            class={`px-3 py-2 ${c.kind === 'money' && v < 0 ? 'text-danger' : ''}`}
                          >
                            {cell(v, c.kind)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </section>
  );
}
