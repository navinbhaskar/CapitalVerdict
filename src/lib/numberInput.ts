/**
 * Parsing and display for numeric form fields.
 * Accepts Indian digit grouping ("1,00,000"), spaces, a trailing unit symbol, and "," as a decimal
 * mark only when there is no grouping (so "6,5" → 6.5 but "1,000" → 1000).
 */

export interface NumberRules {
  min: number;
  max: number;
  integer?: boolean;
  /** Field shows percent; the value is a decimal (6.5 shown → 0.065 stored). */
  percent?: boolean;
  /** Empty input is allowed and means null. */
  optional?: boolean;
}

export type ParseResult =
  | { ok: true; value: number | null }
  | { ok: false; reason: 'required' | 'notANumber' | 'outOfRange' | 'notInteger' };

export function parseNumberText(text: string, rules: NumberRules): ParseResult {
  let cleaned = text.replace(/[\s₹%]/g, '');
  if (cleaned === '')
    return rules.optional ? { ok: true, value: null } : { ok: false, reason: 'required' };

  if (/^\d{1,3}((,\d{2})*,\d{3}|(,\d{3})+)(\.\d+)?$/.test(cleaned))
    cleaned = cleaned.replace(/,/g, '');
  else if (/^\d+,\d+$/.test(cleaned)) cleaned = cleaned.replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) return { ok: false, reason: 'notANumber' };

  const shown = Number(cleaned);
  if (rules.integer && !Number.isInteger(shown)) return { ok: false, reason: 'notInteger' };
  const value = rules.percent ? shown / 100 : shown;
  const eps = 1e-12;
  if (value < rules.min - eps || value > rules.max + eps)
    return { ok: false, reason: 'outOfRange' };
  return { ok: true, value: rules.percent ? Number((shown / 100).toPrecision(12)) : value };
}

const grouped = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 });

/** Text to show in a field that is not being edited. */
export function formatNumberText(
  value: number | null,
  rules: Pick<NumberRules, 'percent'>,
): string {
  if (value === null || !Number.isFinite(value)) return '';
  return rules.percent ? String(Number((value * 100).toFixed(4))) : grouped.format(value);
}

/** Bounds as shown to the user (percent fields in %). */
export function displayBounds(rules: NumberRules): { min: string; max: string } {
  const f = (v: number) => (rules.percent ? `${Number((v * 100).toFixed(4))}%` : grouped.format(v));
  return { min: f(rules.min), max: f(rules.max) };
}
