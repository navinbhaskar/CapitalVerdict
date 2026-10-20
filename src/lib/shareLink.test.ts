import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare, pickKeys, shareUrl, type ShareSchema } from './shareLink';

interface Inputs {
  km: number;
  rate: number;
  years: number;
  fuel: 'cng' | 'ev';
  interest: boolean;
}

const schema: ShareSchema<Inputs> = {
  km: { param: 'km', type: 'number', min: 0, max: 20000 },
  rate: { param: 'r', type: 'number', min: 0, max: 0.3 },
  years: { param: 'y', type: 'number', min: 1, max: 30, integer: true },
  fuel: { param: 'f', type: 'enum', values: ['cng', 'ev'] },
  interest: { param: 'i', type: 'boolean' },
};

const values: Inputs = { km: 1800, rate: 0.09, years: 10, fuel: 'cng', interest: true };

describe('encodeShare', () => {
  it('encodes in schema order with short param names', () => {
    expect(encodeShare(values, schema)).toBe('km=1800&r=0.09&y=10&f=cng&i=1');
  });

  it('strips float noise', () => {
    expect(encodeShare({ rate: 0.1 + 0.2 }, schema)).toBe('r=0.3');
  });

  it('leaves out missing and invalid values', () => {
    expect(encodeShare({ km: NaN, fuel: 'diesel' as 'cng', years: 5 }, schema)).toBe('y=5');
  });

  it('rejects a schema with duplicate params', () => {
    const bad: ShareSchema<{ a: number; b: number }> = {
      a: { param: 'x', type: 'number' },
      b: { param: 'x', type: 'number' },
    };
    expect(() => encodeShare({ a: 1, b: 2 }, bad)).toThrow('duplicate');
  });
});

describe('decodeShare', () => {
  it('round-trips', () => {
    expect(decodeShare(encodeShare(values, schema), schema)).toEqual(values);
  });

  it('accepts a leading "?" and URLSearchParams', () => {
    expect(decodeShare('?km=500', schema)).toEqual({ km: 500 });
    expect(decodeShare(new URLSearchParams('f=ev&i=0'), schema)).toEqual({
      fuel: 'ev',
      interest: false,
    });
  });

  it('drops malformed, out-of-range and unknown params', () => {
    const decoded = decodeShare('km=abc&r=0.5&y=2.5&f=diesel&i=yes&evil=<script>&km2=1', schema);
    expect(decoded).toEqual({});
  });

  it('rejects number forms that Number() would accept but people would not type', () => {
    expect(decodeShare('km=1e3', schema)).toEqual({});
    expect(decodeShare('km=0x10', schema)).toEqual({});
    expect(decodeShare('km=', schema)).toEqual({});
  });

  it('keeps the valid params when some are bad', () => {
    expect(decodeShare('km=1200&r=9', schema)).toEqual({ km: 1200 });
  });
});

describe('shareUrl', () => {
  it('replaces the query and drops the hash', () => {
    expect(shareUrl('https://example.com/tools/car-fuel/?old=1#verdict', { km: 900 }, schema)).toBe(
      'https://example.com/tools/car-fuel/?km=900',
    );
  });
});

describe('pickKeys', () => {
  it('keeps only the keys asked for', () => {
    expect(pickKeys({ a: 1, b: 2, c: null }, ['a', 'c'])).toEqual({ a: 1, c: null });
    expect(pickKeys({ a: 1 }, new Set<'a'>())).toEqual({});
  });
});
