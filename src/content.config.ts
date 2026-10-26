import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Blog posts: Markdown or MDX in src/content/blog. Facts in a post must come from the data files or the
 * tools' own results; illustrative numbers say so in the text.
 */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1).max(200),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    /** decision: one tool's question worked through; basics: a money idea; update: a dated data change. */
    kind: z.enum(['decision', 'basics', 'update']),
    /** The calculator this post leads to, if any. */
    tool: z
      .enum([
        'car-fuel',
        'solar',
        'rent-vs-buy',
        'prepay-or-invest',
        'cash-or-car-loan',
        'ac-payback',
        'old-or-new-tax-regime',
        'plot-vs-fd-vs-mutual-fund',
        'sip-vs-ppf-vs-fd',
        'sip-calculator',
        'lumpsum-calculator',
        'swp-calculator',
        'plan-return',
        'emi-calculator',
      ])
      .optional(),
    /** The guide's headline figure for its listing card; must appear in the post's own text. */
    takeaway: z.object({ figure: z.string().min(1), label: z.string().min(1).max(80) }).optional(),
  }),
});

export const collections = { blog };
