/** Display helpers shared by tool UIs. All output uses Indian digit grouping. */
import { formatINR, formatLakhCrore } from './format';

const decimals = (digits: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function formatNumber(value: number, digits = 0): string {
  return decimals(digits).format(value);
}

/** ₹ with paise for small per-unit prices: 5.6589 → "₹5.66". */
export function formatRupeesPrecise(value: number): string {
  return `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

/** Large amounts in lakh/crore, small ones in full rupees. */
export function formatMoney(value: number): string {
  return Math.abs(value) >= 1e5 ? formatLakhCrore(value) : formatINR(value);
}

/** Decimal rate → "9%" / "6.5%". */
export function formatPercent(rate: number): string {
  return `${Number((rate * 100).toFixed(2))}%`;
}

/** Round amounts for labels and slider values: ₹15.00 lakh → "₹15 lakh", ₹2.50 lakh → "₹2.5 lakh". */
export function formatMoneyShort(value: number): string {
  return formatMoney(value).replace(/\.?0+ (lakh|crore)$/, ' $1');
}
