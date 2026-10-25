# CapitalVerdict

Big money decisions, honest maths, assumptions shown.

Static Astro + TypeScript site with Preact islands, Tailwind and Vitest. English at `/`; Hindi at
`/hi/` is paused (strings stay in `hi.json`, no Hindi pages are built).

## Scripts

| Command              | What it does                                                         |
| -------------------- | -------------------------------------------------------------------- |
| `npm run dev`        | Local dev server at http://localhost:4321                            |
| `npm run build`      | Type check (`astro check`) then build to `dist` (local settings)     |
| `npm run build:prod` | Production build: checks the settings below, builds, scans `dist`    |
| `npm run preview`    | Serve the built site                                                 |
| `npm test`           | Run Vitest once                                                      |
| `npm run lint`       | ESLint                                                               |
| `npm run format`     | Prettier (write)                                                     |
| `npm run verify`     | Format check, lint, test and build in one go (run before committing) |

## Deploy (Cloudflare Pages)

1. Create a Pages project from this repository (or upload `dist` with Wrangler).
2. Build command `npm run build:prod`, output directory `dist`, Node 22.
3. Set these environment variables (Settings, Environment variables, Production):

   | Variable                    | Required | What it does                                                                                                   |
   | --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
   | `SITE_URL`                  | Yes      | Public origin, e.g. `https://capitalverdict.com`. Canonical links, sitemap, RSS, link previews, robots.txt.    |
   | `PUBLIC_CONTACT_EMAIL`      | No       | Overrides the contact address (default support@capitalverdict.com) in the footer, About and "Report an error". |
   | `PUBLIC_CF_ANALYTICS_TOKEN` | No       | Cloudflare Web Analytics token. Off without it; when set, the privacy page describes it automatically.         |

4. Add your domain under Custom domains, then submit `https://<domain>/sitemap-index.xml` in Google
   Search Console.

`npm run build:prod` fails if a required setting is missing, or if any page, feed or sitemap still
contains `TODO_COPY`, `TODO_VERIFY`, `example.invalid` or `localhost`. Sections whose copy is still a
placeholder are left off the page; unverified data shows as "Not verified" with its source.

`public/_headers` sets the security headers (content security policy, HSTS, no framing) and long
caching for fingerprinted assets. Inline scripts are allowed because Astro inlines its island loader
and the theme script; the site has no user-submitted content.

Link-preview images (`public/og/`) and app icons are rendered from the site's fonts and copy; re-render
them if the tagline or a tool question changes.

## Layout

- `src/engine/`: pure calculation modules (no DOM), fully unit-tested
- `src/models/`: one file per decision tool
- `src/data/`: JSON data with `{value, unit, source, effectiveDate}`; unverified values are marked `TODO_VERIFY`
- `src/content/blog/`: guides (served at `/guides/`); `src/content/blogNumbers.test.ts` recomputes every number they quote
- `src/i18n/`: `en.json` and `hi.json` UI strings; `TODO_COPY` / `TODO_COPY_HI` mark copy still to be written
- `src/config/site.ts`: deployment settings read from the environment
- `src/components/`, `src/layouts/`, `src/pages/`: UI
- `brand/`: logo source files
