import { describe, expect, it } from 'vitest';
import { alternates, localizePath, otherLocale, splitLocale } from './routes';

describe('localizePath', () => {
  it('keeps English at the root', () => {
    expect(localizePath('/', 'en')).toBe('/');
    expect(localizePath('/tools/car-fuel/', 'en')).toBe('/tools/car-fuel/');
  });

  it('prefixes Hindi', () => {
    expect(localizePath('/', 'hi')).toBe('/hi/');
    expect(localizePath('/tools/car-fuel/', 'hi')).toBe('/hi/tools/car-fuel/');
    expect(localizePath('tools/car-fuel/', 'hi')).toBe('/hi/tools/car-fuel/');
  });
});

describe('splitLocale', () => {
  it('reads the locale prefix', () => {
    expect(splitLocale('/hi/tools/car-fuel/')).toEqual({ locale: 'hi', path: '/tools/car-fuel/' });
    expect(splitLocale('/hi/')).toEqual({ locale: 'hi', path: '/' });
    expect(splitLocale('/hi')).toEqual({ locale: 'hi', path: '/' });
  });

  it('defaults to English and ignores look-alike prefixes', () => {
    expect(splitLocale('/')).toEqual({ locale: 'en', path: '/' });
    expect(splitLocale('/history/')).toEqual({ locale: 'en', path: '/history/' });
    expect(splitLocale('/en/x/')).toEqual({ locale: 'en', path: '/en/x/' });
  });

  it('round-trips with localizePath', () => {
    for (const path of ['/', '/tools/solar/']) {
      for (const locale of ['en', 'hi'] as const) {
        expect(splitLocale(localizePath(path, locale))).toEqual({ locale, path });
      }
    }
  });
});

describe('alternates', () => {
  it('lists en-IN, hi-IN and x-default as absolute URLs', () => {
    expect(alternates('/tools/solar/', 'https://example.com')).toEqual([
      { hreflang: 'en-IN', href: 'https://example.com/tools/solar/' },
      { hreflang: 'hi-IN', href: 'https://example.com/hi/tools/solar/' },
      { hreflang: 'x-default', href: 'https://example.com/tools/solar/' },
    ]);
  });
});

describe('otherLocale', () => {
  it('swaps', () => {
    expect(otherLocale('en')).toBe('hi');
    expect(otherLocale('hi')).toBe('en');
  });
});
