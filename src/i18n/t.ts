import en from './en.json';
import hi from './hi.json';

export const locales = ['en', 'hi'] as const;
export type Locale = (typeof locales)[number];
export type MessageKey = keyof typeof en;

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, hi };

/** Look up a UI string. `{name}` placeholders are filled from `params`. */
export function t(
  locale: Locale,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  // A missing key shows itself rather than crashing the page; the parity test catches it in CI.
  const template: string = dictionaries[locale][key] ?? en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function htmlLang(locale: Locale): string {
  return locale === 'hi' ? 'hi-IN' : 'en-IN';
}
