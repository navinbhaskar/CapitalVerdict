# Decidewise

Honest money-decision calculators for India. "Big money decisions, honest maths, assumptions shown."
Astro + TypeScript (static), Preact islands, Tailwind v4, Vitest. English at `/`, Hindi at `/hi/`.

## Working rules

- Work milestone by milestone and stop for review after each. Summarise what changed and what to verify.
- Never push to GitHub, create remotes or run GitHub actions unless asked. Local commits are fine.
- Accuracy is the product: every formula has unit tests with hand-checked numbers. If the user supplies
  a spreadsheet, add golden tests that match its cells.
- Never invent data values (prices, tariffs, subsidies, tax rules). Use `TODO_VERIFY` with a source field.
- UI copy the user has not written is `TODO_COPY` (English) / `TODO_COPY_HI` (Hindi). No bulk SEO text.
  When the user asks for drafts, write plain, specific copy and list each drafted key in
  `COPY_REVIEW.md` for their approval. Never state facts (prices, rules, business model) not in the data.
- All UI strings live in `src/i18n/en.json` and `hi.json`; no hardcoded strings in components.
- Tools follow the spreadsheet style of the car fuel page: all inputs visible with a source/note per row,
  "how the answer is worked out" with formulas, net-position chart, month-by-month table with CSV.
- `npm run verify` (format check, lint, tests, type check, build) must pass before committing.

## Design rules

- **Type.** Two self-hosted families via `@fontsource` (never a Google Fonts link): Bricolage Grotesque
  (optical-size cut, weight 500 at display sizes) for display (h1, h2, verdicts) and IBM Plex Sans + IBM Plex Sans Devanagari for body, UI and numbers.
  Use the one type scale defined as `--text-*` tokens in `src/styles/global.css`; no arbitrary font
  sizes in components. Tabular figures (`.num`) for every number that can change.
- **Tokens.** Colours, spacing, radius, shadows and motion (durations and easing curves) are CSS custom
  properties on `:root` in `src/styles/global.css`, exposed to Tailwind through `@theme`. Components use
  token-backed utilities (`bg-surface`, `rounded-card`, `shadow-raised`, `ease-out-expo`,
  `duration-(--duration-fast)`). No hex values, raw pixel sizes or one-off shadows in components.
- **Dark mode** works through the same tokens (`[data-theme='dark']` overrides); never style dark mode
  per component.
- **Glass** (`backdrop-filter`) only on the hero preview, the sticky nav and floating panels (the
  assumptions dialog). Nowhere else.
- **Avoid generic defaults:** no purple-blue gradients, no stock grids of identical icon cards, no emoji
  or Unicode glyphs as icons (draw SVG icons in one stroke weight, see `Icon.astro`), no ALL-CAPS
  eyebrow labels above headings, no 01/02/03 numbering unless the content is a sequence, no middle-dot
  meta strings, no gradient text. Declare elevation once: border or shadow, not both.
- **Accessibility:** visible focus states, WCAG AA contrast (4.5:1 body, 3:1 large text and UI),
  semantic HTML, every input labelled, errors tied to their field with `aria-describedby`.
- **Mobile first.** No horizontal scroll at 375px (and 360px). Touch targets at least 44px.
- **Copy:** clear and specific, in the user's terms. No filler marketing phrases. Buttons name their
  action.
- **Two passes:** build it, then critique it against these rules with screenshots at 375px and desktop,
  in light and dark, and polish.

## Animation rules

- CSS and SVG animation first. Add a JS library only when CSS cannot do it, and then pick one:
  Motion (UI and scroll), GSAP (complex timelines, SVG drawing/morphing), AutoAnimate (list and
  layout changes) or Lottie (only for a designer-made illustration).
- Animate only `transform` and `opacity` (plus `stroke-dashoffset` for SVG line drawing). Never
  width, height, top/left or margins.
- Durations come from tokens: `--duration-instant` 120ms, `--duration-fast` 180ms and
  `--duration-base` 240ms for hovers and presses; `--duration-enter` 450ms and `--duration-focal`
  700ms for entrances. Ease-out curves (`--ease-out-expo`, `--ease-out-back` only for the logo dot),
  never linear.
- `prefers-reduced-motion`: drop movement and keep only short fades and state changes.
- Nothing loops forever or competes with reading. Content is visible by default; motion is an
  enhancement that a failed script cannot hide.
- One focal moment per page (the home hero's break-even line and the logo intro, played once per visit).
- Check performance after motion changes: no layout shift (reserve space for anything that loads late),
  no large new JS bundle.
