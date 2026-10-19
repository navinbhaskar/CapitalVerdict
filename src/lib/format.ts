const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** ₹ with Indian digit grouping, rounded to the rupee: 206236 → "₹2,06,236". */
export function formatINR(amount: number): string {
  return inr.format(Math.round(amount) || 0);
}

const LAKH = 1e5;
const CRORE = 1e7;

/**
 * Compact lakh/crore form for verdicts: 206236 → "₹2.06 lakh".
 * Amounts under one lakh fall back to formatINR.
 * TODO_COPY_HI: unit words are English for now.
 */
export function formatLakhCrore(amount: number, digits = 2): string {
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  if (abs >= CRORE) return `${sign}₹${(abs / CRORE).toFixed(digits)} crore`;
  if (abs >= LAKH) return `${sign}₹${(abs / LAKH).toFixed(digits)} lakh`;
  return formatINR(amount);
}
