/**
 * Minutes to read at about 200 words a minute, never less than one. MDX imports and component
 * tags (tables, charts, calculators) are left out; prose inside a component still counts.
 */
export function readingMinutes(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^import .*$/gm, ' ')
    .replace(/<\/?[A-Z][^>]*>/g, ' ')
    .replace(/[#>*_`|[\]()-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Newest first. */
export function byDateDesc<T extends { data: { date: Date } }>(a: T, b: T): number {
  return b.data.date.getTime() - a.data.date.getTime();
}

export const TOOL_PATHS = {
  'car-fuel': '/tools/car-fuel/',
  solar: '/tools/solar/',
  'rent-vs-buy': '/tools/rent-vs-buy/',
  'prepay-or-invest': '/tools/prepay-or-invest/',
  'cash-or-car-loan': '/tools/cash-or-car-loan/',
  'ac-payback': '/tools/ac-payback/',
  'old-or-new-tax-regime': '/tools/old-or-new-tax-regime/',
  'plot-vs-fd-vs-mutual-fund': '/tools/plot-vs-fd-vs-mutual-fund/',
  'sip-vs-ppf-vs-fd': '/tools/sip-vs-ppf-vs-fd/',
  'sip-calculator': '/tools/sip-calculator/',
  'lumpsum-calculator': '/tools/lumpsum-calculator/',
  'swp-calculator': '/tools/swp-calculator/',
} as const;
