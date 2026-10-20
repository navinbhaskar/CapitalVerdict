import { useId } from 'preact/hooks';
import { t, type Locale } from '@/i18n/t';

interface Props {
  locale: Locale;
  /** Already-translated checklist items. */
  items: string[];
}

/** Things the maths cannot weigh. Ticks are for the reader's own thinking and are not saved. */
export default function NonMoneyChecklist({ locale, items }: Props) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} class="font-display text-2xl font-medium">
        {t(locale, 'checklist.heading')}
      </h2>
      <ul class="mt-3" role="list">
        {items.map((item, i) => (
          <li key={i}>
            <label class="flex min-h-11 cursor-pointer items-center gap-3 rounded-md py-1">
              <span class="relative mt-0.5 inline-flex size-5 shrink-0">
                <input
                  type="checkbox"
                  class="peer size-5 cursor-pointer appearance-none rounded-sm border border-line-strong bg-page transition-colors duration-(--duration-fast) ease-out-quart checked:border-accent-strong checked:bg-accent-strong"
                />
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  class="check-draw pointer-events-none absolute inset-0 hidden size-5 text-page peer-checked:block"
                >
                  <path
                    pathLength={1}
                    d="m6 12.5 4 4L18 8"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
