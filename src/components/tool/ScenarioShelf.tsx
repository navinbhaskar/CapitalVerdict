import { useEffect, useState } from 'preact/hooks';
import { t, type Locale } from '@/i18n/t';

export interface SummaryRow {
  label: string;
  value: string;
}

interface Saved {
  id: string;
  name: string;
  /** The share-link query (`?km=…`) that restores this scenario. */
  query: string;
  summary: SummaryRow[];
}

interface Props {
  locale: Locale;
  /** Storage namespace, e.g. "carFuel". */
  tool: string;
  /** The current share-link query, with its leading "?". */
  query: string;
  /** Headline rows for the current result; null while there is no result. */
  summary: SummaryRow[] | null;
}

const LIMIT = 4;
const keyFor = (tool: string) => `dw.scenarios.${tool}.v1`;

/** Stored data is untrusted: keep only well-formed entries. */
function parse(raw: string | null): Saved[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (s): s is Saved =>
          typeof s === 'object' &&
          s !== null &&
          typeof s.id === 'string' &&
          typeof s.name === 'string' &&
          typeof s.query === 'string' &&
          s.query.startsWith('?') &&
          Array.isArray(s.summary) &&
          s.summary.every(
            (r: unknown) =>
              typeof r === 'object' &&
              r !== null &&
              typeof (r as SummaryRow).label === 'string' &&
              typeof (r as SummaryRow).value === 'string',
          ),
      )
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

/**
 * Save scenarios on this device, compare them side by side with the current one, and print a
 * clean summary. Nothing leaves the browser.
 */
export default function ScenarioShelf({ locale, tool, query, summary }: Props) {
  const [saved, setSaved] = useState<Saved[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    try {
      setSaved(parse(localStorage.getItem(keyFor(tool))));
    } catch {
      // Storage blocked: nothing saved yet.
    }
  }, [tool]);

  const store = (next: Saved[]) => {
    setSaved(next);
    try {
      localStorage.setItem(keyFor(tool), JSON.stringify(next));
    } catch {
      // Storage blocked: kept for this page only.
    }
  };

  const alreadySaved = saved.some((s) => s.query === query);
  const full = saved.length >= LIMIT;
  const save = () => {
    if (!summary || !query || alreadySaved || full) return;
    const used = new Set(saved.map((s) => s.name));
    let n = saved.length + 1;
    while (used.has(t(locale, 'scenarios.name', { n }))) n++;
    store([
      ...saved,
      { id: String(Date.now()), name: t(locale, 'scenarios.name', { n }), query, summary },
    ]);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1600);
  };

  // The current result leads, unless it is one of the saved ones already.
  const columns = [
    ...(summary && !alreadySaved
      ? [{ id: 'now', name: t(locale, 'scenarios.now'), query, summary }]
      : []),
    ...saved,
  ];
  const labels = [...new Set(columns.flatMap((c) => c.summary.map((r) => r.label)))];

  return (
    <section class="mt-4 print:hidden" aria-labelledby={`${tool}-scenarios`}>
      <h2 id={`${tool}-scenarios`} class="sr-only">
        {t(locale, 'scenarios.heading')}
      </h2>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-outline min-h-11 px-3 text-sm"
          onClick={save}
          disabled={!summary || alreadySaved || full}
          aria-live="polite"
        >
          {justSaved || alreadySaved ? t(locale, 'scenarios.saved') : t(locale, 'scenarios.save')}
        </button>
        <button
          type="button"
          class="btn btn-quiet min-h-11 px-3 text-sm"
          onClick={() => window.print()}
          disabled={!summary}
        >
          {t(locale, 'scenarios.print')}
        </button>
      </div>
      {full && !alreadySaved && (
        <p class="mt-2 text-xs text-ink-muted">{t(locale, 'scenarios.limit', { n: LIMIT })}</p>
      )}

      {saved.length > 0 && (
        <details class="group mt-4 rounded-xl border border-line" open>
          <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2.5 font-medium hover:bg-surface">
            {t(locale, 'scenarios.compare', { n: saved.length })}
            <svg
              width="18"
              height="18"
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
          <div class="overflow-x-auto border-t border-line px-4 pb-3">
            <table class="w-full min-w-80 text-left text-sm">
              <caption class="sr-only">{t(locale, 'scenarios.heading')}</caption>
              <thead>
                <tr class="border-b border-line">
                  <td class="py-2" />
                  {columns.map((c) => (
                    <th key={c.id} scope="col" class="py-2 pl-3 align-bottom font-medium">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labels.map((label) => (
                  <tr key={label} class="border-b border-line">
                    <th scope="row" class="py-2 pr-2 align-top font-normal text-ink-muted">
                      {label}
                    </th>
                    {columns.map((c) => (
                      <td key={c.id} class="py-2 pl-3 align-top num">
                        {c.summary.find((r) => r.label === label)?.value ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td class="py-2" />
                  {columns.map((c) => (
                    <td key={c.id} class="py-2 pl-3">
                      {c.id !== 'now' && (
                        <span class="flex flex-wrap gap-x-3">
                          {c.query !== query && (
                            <a href={c.query} class="link inline-flex min-h-11 items-center">
                              {t(locale, 'scenarios.open')}
                            </a>
                          )}
                          <button
                            type="button"
                            class="inline-flex min-h-11 items-center text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
                            onClick={() => store(saved.filter((s) => s.id !== c.id))}
                            aria-label={t(locale, 'scenarios.removeNamed', { name: c.name })}
                          >
                            {t(locale, 'scenarios.remove')}
                          </button>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p class="mt-1 text-xs text-ink-muted">{t(locale, 'scenarios.note')}</p>
          </div>
        </details>
      )}
    </section>
  );
}
