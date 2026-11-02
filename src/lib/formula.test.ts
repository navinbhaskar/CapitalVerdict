import { describe, expect, it } from 'vitest';
import { formulaLines, formulaMathML, hasMaths } from './formula';

const strip = (s: string) => s.replace(/<math[^>]*>|<\/math>/g, '');

describe('formulas as MathML', () => {
  it('a power becomes a superscript, its brackets dropped', () => {
    const m = strip(formulaMathML('(1 + r)^(y − 1)'));
    expect(m.startsWith('<msup>')).toBe(true);
    // The exponent is y − 1 with no brackets of its own.
    const exponent = m.slice(m.lastIndexOf('<mrow><mrow><mi>y</mi>'));
    expect(exponent).toContain('>−</mo>');
    expect(exponent).not.toContain('>(</mo>');
  });

  it('1/12 and r/12 are fractions; km/L and ₹/L stay as written', () => {
    expect(formulaMathML('(1 + yearly rate)^(1/12) − 1')).toContain(
      '<mfrac><mrow><mn>1</mn></mrow><mrow><mn>12</mn></mrow></mfrac>',
    );
    expect(formulaMathML('r/12')).toContain('<mfrac>');
    expect(formulaMathML('km ÷ km/L × ₹/L')).toContain('<mtext>km/L</mtext>');
    expect(formulaMathML('km ÷ km/L × ₹/L')).toContain('<mtext>₹/L</mtext>');
  });

  it('÷ puts everything multiplied so far over the next factor, without its brackets', () => {
    const emi = formulaMathML('P × r × (1 + r)^n ÷ ((1 + r)^n − 1)');
    expect(emi.indexOf('<mfrac>')).toBeLessThan(emi.indexOf('<mi>P</mi>'));
    // The denominator is (1 + r)^n − 1, not ((1 + r)^n − 1).
    expect(emi).toContain('</mrow></mrow><mrow><mrow><msup>');
  });

  it('÷ binds tighter than + and −', () => {
    const m = formulaMathML('km a month ÷ mileage × fuel price + yearly upkeep ÷ 12');
    expect(m.match(/<mfrac>/g)).toHaveLength(2);
    expect(m).toContain('>+</mo>');
  });

  it('Σ applies to the whole term after it; functions keep their brackets', () => {
    const m = formulaMathML('Σ cash flow in month m ÷ (1 + i)^m');
    expect(m.indexOf('>Σ</mo>')).toBeLessThan(m.indexOf('<mfrac>'));
    expect(formulaMathML('bill(other + km) − bill(other)')).toContain(
      '<mtext>bill</mtext><mo>(</mo>',
    );
  });

  it('hyphenated words stay whole; text is escaped', () => {
    expect(formulaMathML('e-scooter − state incentive')).toContain('<mtext>e-scooter</mtext>');
    expect(formulaMathML('a <b> & c')).toContain('&lt;b&gt; &amp; c');
  });

  it('splits a block at each line’s first “=”', () => {
    const lines = formulaLines('r   = yearly rate ÷ 12\nn   = tenure in months');
    expect(lines).toHaveLength(2);
    expect(lines[0]!.lhs).toContain('<mi>r</mi>');
    expect(lines[0]!.rhs).toContain('<mfrac>');
  });

  it('knows which formulas need drawing', () => {
    expect(hasMaths('₹40,000 ÷ 12')).toBe(true);
    expect(hasMaths('(1 + r)^n')).toBe(true);
    expect(hasMaths('1,800 × ₹2.71')).toBe(false);
  });
});
