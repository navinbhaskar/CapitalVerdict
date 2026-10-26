/**
 * Site search: after each build, Pagefind indexes the built pages and writes its index and search
 * script to dist/pagefind/. Only the parts of a page marked data-pagefind-body are indexed (the
 * calculators and guides); everything else, including the home page, is left out. No server.
 */
import { fileURLToPath } from 'node:url';
import * as pagefind from 'pagefind';

/** @returns {import('astro').AstroIntegration} */
export default function pagefindIntegration() {
  return {
    name: 'capitalverdict:pagefind',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const site = fileURLToPath(dir);
        const { index, errors } = await pagefind.createIndex({ forceLanguage: 'en' });
        if (!index) throw new Error(`Pagefind could not start: ${errors.join('; ')}`);
        const added = await index.addDirectory({ path: site });
        if (added.errors.length > 0) throw new Error(added.errors.join('; '));
        const written = await index.writeFiles({ outputPath: `${site}/pagefind` });
        if (written.errors.length > 0) throw new Error(written.errors.join('; '));
        logger.info(`Indexed ${added.page_count} pages for search.`);
        await pagefind.close();
      },
    },
  };
}
