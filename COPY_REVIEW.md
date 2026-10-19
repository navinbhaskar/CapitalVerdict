# Copy to review

English copy drafted on 2026-10-19 to replace `TODO_COPY` placeholders. Every string lives in
`src/i18n/en.json`; edit it there. Tick a line once you have approved or rewritten it.
Hindi (`src/i18n/hi.json`) is still `TODO_COPY_HI` everywhere except the site name and the language
switch.

## Things to check before approving

- **Principle "Post-tax and inflation-aware"** (`principle.realTerms.body`): the car fuel tool charges
  interest on the extra price but does not adjust for inflation or tax. The draft says "time value of
  money" to stay accurate today. Tighten it once rent vs buy and solar exist.
- **Principle "No product recommendations"** (`principle.noProducts.body`): says nothing about how the
  site earns money, because that isn't decided. Add a line if you want one.
- **Disclaimers** (`footer.disclaimer`, `tool.disclaimer`): the "not registered with SEBI or IRDAI"
  wording comes from your spec. Have someone qualified check the legal pages in M6.
- **Worked example** (`carFuel.workedExample.intro`): cites the Lucknow prices from your workbook
  (September 2026). Update it when the data file changes.

## Strings

| Key                                       | Where it shows                         |
| ----------------------------------------- | -------------------------------------- |
| [ ] `site.description`                    | Meta description for the home page     |
| [ ] `home.intro`                          | Home hero, under the headline          |
| [ ] `tool.rentVsBuy.question`             | Home decisions list (coming soon)      |
| [ ] `tool.solar.question`                 | Home decisions list (coming soon)      |
| [ ] `principle.assumptions.body`          | Home, "How we work"                    |
| [ ] `principle.conservative.body`         | Home, "How we work"                    |
| [ ] `principle.realTerms.body`            | Home, "How we work" (see note above)   |
| [ ] `principle.noProducts.body`           | Home, "How we work" (see note above)   |
| [ ] `footer.disclaimer`                   | Footer on every page                   |
| [ ] `assumptions.intro`                   | Top of the assumptions panel           |
| [ ] `tool.disclaimer`                     | Under every tool's question            |
| [ ] `carFuel.metaDescription`             | Meta description for the car fuel tool |
| [ ] `carFuel.explanation`                 | Car fuel tool, "How this works"        |
| [ ] `carFuel.workedExample.intro`         | Car fuel tool, "Worked example"        |
| [ ] `carFuel.faq.1.q` – `carFuel.faq.4.a` | Car fuel tool, "Questions" (4 pairs)   |
