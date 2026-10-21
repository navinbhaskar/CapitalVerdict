import { t, type Locale } from '@/i18n/t';

interface Props {
  locale: Locale;
  text: string;
  /** Id of the inputs heading; the first field under it gets focus. */
  inputsId: string;
}

/** "This answer uses example numbers", with a way straight to the first field to change them. */
export default function ExampleNote({ locale, text, inputsId }: Props) {
  const go = () => {
    const heading = document.getElementById(inputsId);
    const section = heading?.closest('section');
    if (!heading || !section) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    heading.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    section
      .querySelector<HTMLInputElement>('input:not([type="range"]):not([type="radio"])')
      ?.focus({ preventScroll: true });
  };
  return (
    <p class="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-strong">
      {text}{' '}
      <button
        type="button"
        onClick={go}
        class="inline-flex min-h-6 items-center font-medium underline underline-offset-4"
      >
        {t(locale, 'example.useMine')}
      </button>
    </p>
  );
}
