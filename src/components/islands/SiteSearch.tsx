import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { t, type Locale, type MessageKey } from '@/i18n/t';

interface Props {
  locale: Locale;
}

/** The part of Pagefind's browser API this dialog uses. */
interface PagefindResult {
  url: string;
  excerpt: string;
  meta: { title?: string };
}
interface Pagefind {
  init: () => Promise<void>;
  debouncedSearch: (
    term: string,
    options?: object,
    ms?: number,
  ) => Promise<{ results: { data: () => Promise<PagefindResult> }[] } | null>;
}

type Status = 'idle' | 'loading' | 'ready' | 'unavailable';
interface Hit {
  url: string;
  title: string;
  /** Pagefind's excerpt: our own page text, with the matched words in <mark>. */
  excerpt: string;
  kind: 'tool' | 'guide' | 'other';
}

const MAX_RESULTS = 8;

let loader: Promise<Pagefind | null> | null = null;
/**
 * Loads Pagefind's script from the built site once. It is written by the build (see
 * integrations/pagefind.mjs), so it is missing under `astro dev`.
 */
function loadPagefind(): Promise<Pagefind | null> {
  loader ??= (async () => {
    try {
      const url = '/pagefind/pagefind.js';
      const pf = (await import(/* @vite-ignore */ url)) as Pagefind;
      await pf.init();
      return pf;
    } catch {
      return null;
    }
  })();
  return loader;
}

const kindOf = (url: string): Hit['kind'] =>
  url.startsWith('/tools/') ? 'tool' : url.startsWith('/guides/') ? 'guide' : 'other';

/** Search over the calculators and guides, in a dialog opened from the header (or with "/"). */
export default function SiteSearch({ locale }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [searched, setSearched] = useState('');
  const [total, setTotal] = useState(0);
  const titleId = useId();
  const listId = useId();

  const open = () => {
    dialogRef.current?.showModal();
    inputRef.current?.focus();
    inputRef.current?.select();
    if (status === 'idle') {
      setStatus('loading');
      void loadPagefind().then((pf) => setStatus(pf ? 'ready' : 'unavailable'));
    }
  };
  const close = () => dialogRef.current?.close();

  // "/" opens search from anywhere except while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (dialogRef.current?.open) return;
      e.preventDefault();
      open();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    const term = query.trim();
    if (status !== 'ready' || term === '') {
      setHits([]);
      setSearched('');
      return;
    }
    let live = true;
    void (async () => {
      const pf = await loadPagefind();
      const search = await pf?.debouncedSearch(term, {}, 150);
      // A newer keystroke replaced this search.
      if (!live || !search) return;
      const data = await Promise.all(search.results.slice(0, MAX_RESULTS).map((r) => r.data()));
      if (!live) return;
      setHits(
        data.map((d) => ({
          url: d.url,
          title: d.meta.title ?? d.url,
          excerpt: d.excerpt,
          kind: kindOf(d.url),
        })),
      );
      setTotal(search.results.length);
      setSearched(term);
    })();
    return () => {
      live = false;
    };
  }, [query, status]);

  const message =
    status === 'unavailable'
      ? t(locale, 'search.unavailable')
      : query.trim() !== '' && status === 'loading'
        ? t(locale, 'search.loading')
        : query.trim() !== '' && searched !== query.trim()
          ? t(locale, 'search.searching')
          : searched !== '' && hits.length === 0
            ? t(locale, 'search.none', { query: searched })
            : query.trim() === ''
              ? t(locale, 'search.hint')
              : '';

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-keyshortcuts="/"
        aria-label={t(locale, 'search.open')}
        class="nav-pill"
      >
        <SearchIcon />
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(e) => e.target === dialogRef.current && close()}
        class="search-dialog fixed inset-x-0 top-0 m-0 mx-auto max-h-dvh w-full max-w-xl overflow-y-auto overscroll-contain bg-raised p-0 text-ink shadow-float backdrop:bg-scrim sm:top-16 sm:max-h-[calc(100dvh-8rem)] sm:rounded-xl"
      >
        <div class="sticky top-0 z-10 border-b border-line px-4 pt-3 pb-3 glass sm:px-5">
          <div class="flex items-center justify-between gap-3">
            <h2 id={titleId} class="font-display text-xl font-medium">
              {t(locale, 'search.title')}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t(locale, 'search.close')}
              class="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors duration-(--duration-fast) ease-out-quart hover:bg-surface hover:text-ink"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
          <div class="relative mt-2">
            <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder={t(locale, 'search.placeholder')}
              aria-label={t(locale, 'search.label')}
              aria-controls={listId}
              autocomplete="off"
              enterKeyHint="search"
              class="min-h-11 w-full rounded-lg border border-line-strong bg-page py-2 pr-3 pl-10 text-base text-ink transition-colors duration-(--duration-fast) ease-out-quart placeholder:text-ink-subtle hover:border-ink-subtle focus:border-accent-strong"
            />
          </div>
        </div>
        <div class="px-4 py-3 sm:px-5">
          <p class="text-sm text-ink-muted" role="status" aria-live="polite">
            {message ||
              t(
                locale,
                total > hits.length
                  ? 'search.countTop'
                  : total === 1
                    ? 'search.countOne'
                    : 'search.count',
                { n: total, shown: hits.length },
              )}
          </p>
          <ul id={listId} class="mt-2 divide-y divide-line" role="list">
            {hits.map((hit) => (
              <li key={hit.url}>
                <a
                  href={hit.url}
                  class="-mx-2 block rounded-lg px-2 py-3 transition-colors duration-(--duration-fast) ease-out-quart hover:bg-surface"
                >
                  <span class="block text-sm text-ink-muted">
                    {t(locale, `search.kind.${hit.kind}` as MessageKey)}
                  </span>
                  <span class="mt-0.5 block font-medium text-accent-strong">{hit.title}</span>
                  <span
                    class="search-excerpt mt-1 block text-sm text-ink-muted"
                    // Pagefind's excerpt of our own pages, with <mark> around the matched words.
                    dangerouslySetInnerHTML={{ __html: hit.excerpt }}
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.75" />
      <path d="m16 16 4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
    </svg>
  );
}
