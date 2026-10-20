import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale } from '@/i18n/t';

interface Props {
  locale: Locale;
  /** Remembers whether this visitor keeps the section open, per tool. */
  storageKey: string;
  /** One line on what is inside, e.g. "Fuel prices, mileage, interest…". */
  hint: string;
  /** Open regardless of the visitor's choice, e.g. while a field inside needs fixing. */
  forceOpen?: boolean;
  children: ComponentChildren;
}

/**
 * Quick mode: the few questions only the visitor can answer sit above; every other assumption
 * (already filled in) lives here, one click away and still fully visible when opened.
 */
export default function Refine({ locale, storageKey, hint, forceOpen = false, children }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === '1') setOpen(true);
    } catch {
      // Storage blocked: start closed.
    }
  }, [storageKey]);

  const shown = open || forceOpen;
  const toggle = (next: boolean) => {
    if (next === shown) return;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? '1' : '0');
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
  };

  return (
    <details
      class="group mt-5 rounded-xl border border-line"
      open={shown}
      onToggle={(e) => toggle((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-surface">
        <span>
          <span class="block font-display text-lg font-medium">{t(locale, 'refine.title')}</span>
          <span class="mt-0.5 block text-sm text-ink-muted">{hint}</span>
        </span>
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
      <div class="border-t border-line px-4 pb-4">{children}</div>
    </details>
  );
}
