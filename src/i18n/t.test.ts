import { describe, expect, it } from 'vitest';
import en from './en.json';
import hi from './hi.json';
import { t } from './t';

describe('i18n dictionaries', () => {
  it('hi has exactly the same keys as en', () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
  });

  it('fills placeholders', () => {
    expect(t('en', 'footer.copyright', { year: 2026 })).toBe('© 2026 Decidewise');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(t('en', 'footer.copyright')).toBe('© {year} Decidewise');
  });
});
