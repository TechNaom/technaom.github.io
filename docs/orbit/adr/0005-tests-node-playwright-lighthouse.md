# ADR 0005: Unit tests with node:test, browser checks with Playwright, speed with Lighthouse CI

Date: 2026-11-27. Status: proposed

## Context
The build rule is test first. Today the site has no tests besides the type check, the build and the copy gate.
R9, R10 and R12 to R17 and N4 need checks in a real browser. Facts checked live on 2026-11-27.

## Options

| Option | Fit | Monthly cost | Operating effort | Lock-in | On failure |
|---|---|---|---|---|---|
| A. `node --test` for the pure logic (scene data from `teams.json`, view choice, layout maths, seeded random); [Playwright](https://github.com/microsoft/playwright) 1.65.1 (Apache-2.0) with Chromium for browser checks (JavaScript off, WebGL off, reduced motion, screenshots at set scroll points, labels present); [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm) 4.14.1 (MPL-2.0, used unchanged) for contrast; [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) 0.16.1 (Apache-2.0) for N4 | Every requirement gets an automatic check; the unit layer adds no dependency | Rs 0 (GitHub Actions on a public repo) | Medium: browsers download in CI (cached) | Low | A flaky screenshot: compare with a tolerance; the seeded layout keeps frames stable |
| B. Vitest instead of node:test, the rest the same | Nicer output, one more dependency | Rs 0 | Medium | Low | Same |
| C. Manual checks by the owner only | No setup | Rs 0 | High: every change needs the owner | None | Regressions reach production |

## Decision
Option A. Browser checks run against `astro preview` in `site-check.yml` on every branch push, before the preview
deploy. Firefox and WebKit runs (R17's three browsers) are a test-flight step, not every push.

## Why
Real browser evidence for each requirement at no cost, with the fewest new dependencies. MPL-2.0 is fine for axe
because we use it unchanged and only in tests.

## Revisit when
CI on a branch takes more than 10 minutes.
