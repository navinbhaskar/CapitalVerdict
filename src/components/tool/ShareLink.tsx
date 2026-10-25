import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { t, type Locale } from '@/i18n/t';

interface Props {
  locale: Locale;
  /** Full URL that restores the current result. */
  url: string;
  /** The answer in one line, sent with the link when sharing to WhatsApp. */
  headline?: string;
}

type Status = 'idle' | 'copied' | 'failed';

/** Copy-link control for a tool result. Falls back to a selectable field when the clipboard is blocked. */
export default function ShareLink({ locale, url, headline }: Props) {
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
      <div class="flex flex-wrap gap-2">
        <button type="button" onClick={copy} class="btn btn-outline">
          {status === 'copied' ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              class="check-draw text-accent-strong"
            >
              <path
                pathLength={1}
                d="m5 12.5 4.5 4.5L19 7.5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
              />
            </svg>
          )}
          {status === 'copied' ? t(locale, 'share.copied') : t(locale, 'share.copy')}
        </button>
        {/* WhatsApp is where these decisions get discussed: the answer and the link in one message. */}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${headline ? `${t(locale, 'share.message', { headline })} ` : ''}${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-outline"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linejoin="round"
            />
          </svg>
          {t(locale, 'share.whatsapp')}
        </a>
      </div>
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
            class="min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
          />
        </div>
      )}
    </div>
  );
}
