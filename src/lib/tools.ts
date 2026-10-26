/**
 * The calculators, grouped by area of life. One list for the home page, the nav's Calculators menu
 * and the footer, so a new tool shows up everywhere at once.
 */
import type { MessageKey } from '@/i18n/t';

export type ToolIcon =
  | 'fuel'
  | 'sun'
  | 'home'
  | 'banknote'
  | 'car'
  | 'snowflake'
  | 'percent'
  | 'plot'
  | 'piggy'
  | 'bars'
  | 'trend'
  | 'outflow'
  | 'exchange'
  | 'calendar'
  | 'shield';

export interface ToolEntry {
  /** i18n prefix: `tool.{key}.title`, `.question`, `.gives`. */
  key: string;
  path: string;
  icon: ToolIcon;
}

export const TOOL_GROUPS: { title: MessageKey; tools: ToolEntry[] }[] = [
  {
    title: 'home.group.car',
    tools: [
      { key: 'carFuel', path: '/tools/car-fuel/', icon: 'fuel' },
      { key: 'carLoan', path: '/tools/cash-or-car-loan/', icon: 'car' },
    ],
  },
  {
    title: 'home.group.home',
    tools: [
      { key: 'rentVsBuy', path: '/tools/rent-vs-buy/', icon: 'home' },
      { key: 'prepay', path: '/tools/prepay-or-invest/', icon: 'banknote' },
      { key: 'emi', path: '/tools/emi-calculator/', icon: 'calendar' },
    ],
  },
  {
    title: 'home.group.money',
    tools: [
      { key: 'plotVs', path: '/tools/plot-vs-fd-vs-mutual-fund/', icon: 'plot' },
      { key: 'saving', path: '/tools/sip-vs-ppf-vs-fd/', icon: 'piggy' },
      { key: 'planReturn', path: '/tools/plan-return/', icon: 'exchange' },
      { key: 'termPlan', path: '/tools/term-plus-investing/', icon: 'shield' },
      { key: 'taxRegime', path: '/tools/old-or-new-tax-regime/', icon: 'percent' },
    ],
  },
  {
    title: 'home.group.funds',
    tools: [
      { key: 'sip', path: '/tools/sip-calculator/', icon: 'bars' },
      { key: 'lumpsum', path: '/tools/lumpsum-calculator/', icon: 'trend' },
      { key: 'swp', path: '/tools/swp-calculator/', icon: 'outflow' },
    ],
  },
  {
    title: 'home.group.power',
    tools: [
      { key: 'solar', path: '/tools/solar/', icon: 'sun' },
      { key: 'ac', path: '/tools/ac-payback/', icon: 'snowflake' },
    ],
  },
];

export const toolKey = (entry: ToolEntry, field: 'title' | 'question' | 'gives') =>
  `tool.${entry.key}.${field}` as MessageKey;
