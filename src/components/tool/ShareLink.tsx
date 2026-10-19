import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { t, type Locale } from '@/i18n/t';

interface Props {
  locale: Locale;
  /** Full URL that restores the current result. */
  url: string;
}

type Status = 'idle' | 'copied' | 'failed';

/** Copy-link control for a tool result. Falls back to a selectable field when the clipboard is blocked. */
export default function ShareLink({ locale, url }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => setStatus('idle'), [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch {
      setStatus('failed');
      requestAnimationFrame(() => inputRef.current?.select());
    }
  };

  return (
    <div class="flex flex-col gap-2">
      <button
        type="button"
        onClick={copy}
        class="inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-line-strong px-4 text-sm font-medium transition-colors duration-200 hover:bg-surface"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
          />
        </svg>
        {status === 'copied' ? t(locale, 'share.copied') : t(locale, 'share.copy')}
      </button>
      <p class="sr-only" aria-live="polite">
        {status === 'copied' ? t(locale, 'share.copied') : ''}
      </p>
      {status === 'failed' && (
        <div>
          <label for={id} class="mb-1 block text-sm text-ink-muted">
            {t(locale, 'share.failed')}
          </label>
          <input
            id={id}
            ref={inputRef}
            readOnly
            value={url}
            aria-label={t(locale, 'share.linkLabel')}
            class="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
          />
        </div>
      )}
    </div>
  );
}
