import { t, type Locale } from '@/i18n/t';

/** 46 → "3 years 10 months", 12 → "1 year", 7 → "7 months". */
export function formatDuration(locale: Locale, months: number): string {
  const whole = Math.max(0, Math.round(months));
  const y = Math.floor(whole / 12);
  const m = whole % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(t(locale, y === 1 ? 'duration.year' : 'duration.years', { n: y }));
  if (m > 0 || y === 0) {
    parts.push(t(locale, m === 1 ? 'duration.month' : 'duration.months', { n: m }));
  }
  return parts.join(' ');
}
