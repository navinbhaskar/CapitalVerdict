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
      <h2 id={`${id}-h`} class="text-lg font-semibold">
        {t(locale, 'checklist.heading')}
      </h2>
      <ul class="mt-4 space-y-1" role="list">
        {items.map((item, i) => (
          <li key={i}>
            <label class="flex min-h-11 cursor-pointer items-start gap-3 rounded-md py-2">
              <input
                type="checkbox"
                class="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-[var(--color-accent-strong)]"
              />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
