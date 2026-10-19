# Decidewise

Big money decisions, honest maths, assumptions shown.

Static Astro + TypeScript site with Preact islands, Tailwind and Vitest. English at `/`, Hindi at `/hi/`.

## Scripts

| Command           | What it does                                    |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Local dev server at http://localhost:4321       |
| `npm run build`   | Type check (`astro check`) then build to `dist` |
| `npm run preview` | Serve the built site                            |
| `npm test`        | Run Vitest once                                 |
| `npm run lint`    | ESLint                                          |
| `npm run format`  | Prettier (write)                                |
| `npm run verify`  | Format check, lint, test and build in one go    |

Set `SITE_URL` at build time once the production domain is decided.

## Layout

- `src/engine/`: pure calculation modules (no DOM), fully unit-tested
- `src/models/`: one file per decision tool
- `src/data/`: JSON data with `{value, unit, source, effectiveDate}`; unverified values are marked `TODO_VERIFY`
- `src/i18n/`: `en.json` and `hi.json` UI strings; `TODO_COPY` / `TODO_COPY_HI` mark copy still to be written
- `src/components/`, `src/layouts/`, `src/pages/`: UI
- `brand/`: logo source files
