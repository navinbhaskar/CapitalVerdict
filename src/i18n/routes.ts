import { locales, type Locale } from './t';

export const defaultLocale: Locale = 'en';

/** Locales with built pages. Hindi strings stay in hi.json, but its pages are paused. */
export const PUBLISHED_LOCALES: readonly Locale[] = ['en'];

/**
 * Locale-neutral path → path for `locale`. English lives at the root, other locales under /<locale>/.
 * `localizePath('/tools/car-fuel/', 'hi')` → `/hi/tools/car-fuel/`.
 */
export function localizePath(path: string, locale: Locale): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return locale === defaultLocale ? clean : `/${locale}${clean === '/' ? '/' : clean}`;
}

/** Split a URL pathname into its locale and the locale-neutral path. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const match = /^\/([a-z]{2})(\/.*|$)/.exec(pathname);
  const candidate = match?.[1];
  if (
    candidate &&
    candidate !== defaultLocale &&
    (locales as readonly string[]).includes(candidate)
  ) {
    return { locale: candidate as Locale, path: match[2] || '/' };
  }
  return { locale: defaultLocale, path: pathname || '/' };
}

export interface Alternate {
  hreflang: string;
  href: string;
}

/** hreflang links for every locale plus x-default, as absolute URLs. */
export function alternates(
  path: string,
  site: URL | string,
  published: readonly Locale[] = locales,
): Alternate[] {
  const links: Alternate[] = published.map((locale) => ({
    hreflang: locale === 'hi' ? 'hi-IN' : 'en-IN',
    href: new URL(localizePath(path, locale), site).href,
  }));
  links.push({
    hreflang: 'x-default',
    href: new URL(localizePath(path, defaultLocale), site).href,
  });
  return links;
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'hi' : 'en';
}
