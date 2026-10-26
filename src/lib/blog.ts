import { TOOL_GROUPS } from './tools';

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
  'plan-return': '/tools/plan-return/',
  'emi-calculator': '/tools/emi-calculator/',
} as const;

/**
 * The calculator area a guide belongs to: the index in TOOL_GROUPS of the group holding its
 * tool, or null for a guide without one. Guides pages group posts the same way as the tools.
 */
export function guideArea(tool: keyof typeof TOOL_PATHS | undefined): number | null {
  if (!tool) return null;
  const path = TOOL_PATHS[tool];
  const index = TOOL_GROUPS.findIndex((g) => g.tools.some((entry) => entry.path === path));
  return index < 0 ? null : index;
}

/** A stable anchor for an area, from its heading key: 'home.group.car' → 'car'. */
export const areaId = (index: number) => TOOL_GROUPS[index]!.title.split('.').at(-1)!;
