import { useEffect, useState } from 'preact/hooks';
import { t, type Locale } from '@/i18n/t';

interface Props {
  locale: Locale;
  /** The short answer, as in the answer card. */
  headline: string;
  /** The element whose visibility hides the bar (the answer card or its wrapper). */
  anchorId?: string;
}

/**
 * Phones only: while the answer card is off screen (the visitor is editing inputs further down),
 * a floating bar keeps the answer in view and jumps back to it.
 */
export default function ResultBar({ locale, headline, anchorId = 'verdict' }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const anchor = document.getElementById(anchorId);
    const wide = window.matchMedia('(min-width: 64rem)');
    if (!anchor || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry) setShow(!wide.matches && !entry.isIntersecting);
    });
    io.observe(anchor);
    return () => io.disconnect();
  }, [anchorId]);

  if (!show || !headline) return null;
  return (
    <div class="stagger fixed inset-x-3 bottom-3 z-30 lg:hidden">
      <div class="flex items-center justify-between gap-3 rounded-xl py-2 pr-2 pl-4 shadow-float glass">
        <p class="font-display text-lg leading-snug font-medium" aria-live="polite">
          {headline}
        </p>
        <a href={`#${anchorId}`} class="btn btn-primary min-h-11 shrink-0 px-4 text-sm">
          {t(locale, 'resultBar.cta')}
        </a>
      </div>
    </div>
  );
}
