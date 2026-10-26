import { useId } from 'preact/hooks';
import { t, type Locale } from '@/i18n/t';

interface Props {
  locale: Locale;
  /** Already-translated items. */
  items: string[];
}

/**
 * Things the maths cannot weigh. A read-only list: each item is a point to consider, not a task to
 * tick, so it carries a small balance icon rather than a checkbox.
 */
export default function NonMoneyChecklist({ locale, items }: Props) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} class="font-display text-2xl font-medium">
        {t(locale, 'checklist.heading')}
      </h2>
      <ul class="mt-3 space-y-2.5">
        {items.map((item, i) => (
          <li key={i} class="flex gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              class="mt-0.5 shrink-0 text-accent-strong"
            >
              <path
                d="M12 4v16M8 20h8M5 7h14M5 7l-3 6a3 3 0 0 0 6 0L5 7ZM19 7l-3 6a3 3 0 0 0 6 0l-3-6Z"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
