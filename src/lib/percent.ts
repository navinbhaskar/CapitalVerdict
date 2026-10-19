/** Decimal rate → text for a "%" input: 0.065 → "6.5". Avoids float noise like "6.500000000000001". */
export function toPercentText(rate: number | null): string {
  if (rate === null) return '';
  return String(Number((rate * 100).toFixed(4)));
}

export type PercentParse =
  { ok: true; value: number | null } | { ok: false; reason: 'notANumber' | 'outOfRange' };

/**
 * Text from a "%" input → decimal rate. Accepts "6.5", "6,5", " 6.5 % ". Empty → null when allowed.
 * `max` is a decimal (0.2 = 20%).
 */
export function parsePercent(text: string, max: number, allowEmpty: boolean): PercentParse {
  const cleaned = text.replace(/%/g, '').replace(',', '.').trim();
  if (cleaned === '')
    return allowEmpty ? { ok: true, value: null } : { ok: false, reason: 'notANumber' };
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(cleaned)) return { ok: false, reason: 'notANumber' };
  const value = Number(cleaned) / 100;
  if (value < 0 || value > max + 1e-12) return { ok: false, reason: 'outOfRange' };
  return { ok: true, value };
}
