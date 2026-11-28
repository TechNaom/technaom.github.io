# Tasks: Personal website, 3D neural network lane

Version 1, 2026-11-27. Architecture: [architecture.md](architecture.md) (with Implementation decisions 1 to 20).
PRD: [prd.md](prd.md), R9 to R18 and N1 to N6. Lane branch: `site-3d-lane` (the spike branch `site-3d` stays local,
reference only, never merged). T1 creates `site-3d-lane` from `main`. Every task is then its own branch (`t<n>-<slug>`) and a pull request into
`site-3d-lane`; the lane merges into `main` only after test flight and the owner's UAT.

Shell for every command: Git Bash on Windows, or bash in CI. Paths use forward slashes. All commands run from `site/`
unless they start with `cd`.

## Milestones

| Milestone | Leaves the product able to | Tasks |
|---|---|---|
| M1 Skeleton | Show a live (plain) neural network behind all 7 pages on the lane preview, fall back cleanly without WebGL, with unit, browser, accessibility and copy checks in CI | T1-T7 |
| M2 Views and story | Move the camera per section (network, dial, journey, drift), tell the home story with labels, quiet dense sections, fire signals, respect reduced motion | T8-T14 |
| M3 Hardening and release | Meet N4 on lite and full tiers, block third-party requests, rehearse the rollback, merge after UAT, check the live site | T15-T20 |

## M1 Skeleton

| ID | Task | Serves | Test (written first) | Done check | Depends on | Size | Issue |
|---|---|---|---|---|---|---|---|
| T1 | ✅ Test harness and CI wiring (PR #21) | N5, N6 | `tests/unit/ci.test.mjs` reads `site-check.yml` and fails without the unit, Playwright and copy steps | `node --test tests/unit` passes; CI green on the lane branch | - | M | #1 |
| T2 | ✅ Scene data from `teams.json` (PR #22) | R9, R13 | `tests/unit/scene-data.test.mjs`: 9 teams, 41 agents, equals `facts.json`; hours; slugs | `node --test tests/unit` passes | T1 | S | #2 |
| T3 | ✅ View registry and `pickView` (PR #23) | R10, R18 | `tests/unit/views.test.mjs`: middle line, nesting, unknown name, progress | `node --test tests/unit` passes | T1 | S | #3 |
| T4 | ✅ Dark only, tokens and layers (PR #24) | R16, R17 | `tests/e2e/dark.spec.mjs`: `data-theme="dark"` and axe contrast on all 7 pages with JavaScript off | `npx playwright test dark` passes | T1 | M | #4 |
| T5 | ✅ `Universe.astro` and `boot.js`: decide, wait, load, fall back (PR #25) | R14, R17, N2, N3 | `tests/e2e/fallback.spec.mjs`: JavaScript off, WebGL off, chunk 500, data saver: state, no `u3d-on`, text visible | `npx playwright test fallback` passes | T2, T4 | M | #5 |
| T6 ✅ | Scene chunk: the network drawn | R9, R14, N3 | `tests/e2e/scene.spec.mjs`: `data-u3d-state="on"` and `u3d-on` on all 7 pages; `window.__u3d.data` equals the JSON; size and licence checks | `npx playwright test scene` and `node --test tests/unit` pass | T3, T5 | M | #6 |
| T7 ✅ | Lane preview and smoke test | R9, N5 | `tests/e2e/smoke.spec.mjs` run against `BASE_URL` | Smoke passes against `https://site-3d-lane.manoharpapasani.pages.dev` | T6 | S | #7 |

## M2 Views and story (cards written when M2 starts)

| ID | Task | Serves | Test (written first) | Done check | Depends on | Size | Issue |
|---|---|---|---|---|---|---|---|
| T8 | Camera per view, with `network` and `drift`; `data-scene` on every page from `screens.json` | R10 | e2e: scroll each route, `data-u3d-view` matches `screens.json` | Playwright passes | T6 | M | #8 |
| T9 | `dial` view and `StageLabels.astro`; home dial stage | R12, R13 | e2e: dial labels in HTML and placed; copy gate reads them | Playwright and copy gate pass | T8 | M | #9 |
| T10 | `journey` view, `journey.json`, tall stage with sticky card, scroll progress | R12, R13 | unit: progress; e2e: progress 0, 0.5, 1 screenshots | Playwright passes | T9 | M | #10 |
| T11 | Labels overlay: projection, hide behind camera, phone layout (under 900px) | R12, R13 | e2e at 1280×800 and 390×844: labels in viewport, none overlapping | Playwright passes | T10 | M | #11 |
| T12 | Quiet sections (`data-scene-quiet`) on workforce, architecture, notebook | R18 | e2e: opacity factor 0.4 on the named selectors | Playwright passes | T8 | S | #12 |
| T13 | Signals and reduced motion | R11, R15 | e2e: pulses counted in test mode; with `reducedMotion: "reduce"` none, camera jumps | Playwright passes | T8 | S | #13 |
| T14 | Views guide `src/lib/scene/README.md`; one page uses views with no script of its own | R10 | unit: every view named in the guide exists in the registry | `node --test tests/unit` passes | T8 | S | #14 |

## M3 Hardening and release (cards written when M3 starts)

| ID | Task | Serves | Test (written first) | Done check | Depends on | Size | Issue |
|---|---|---|---|---|---|---|---|
| T15 | Quality tiers, lite switch, stop on slow, context lost | N4, R17 | unit: tier rule (36 ms over 2 s, after 1 s, not hidden); e2e: forced slow frames fall back | Tests pass | T13 | M | #15 |
| T16 | Lighthouse CI with N4 assertions (warn until the owner confirms) | N4 | CI-file test for the `lhci` step | `npx lhci autorun` report in CI | T7 | S | #16 |
| T17 | Network check (only our origin and Google Fonts) and screenshots of the 7 routes | N3, R12 | e2e network log and screenshot baseline | Playwright passes | T11 | S | #17 |
| T18 | Release rehearsal: backup tag on `main`, revert rehearsed on a scratch branch | N5 | Script checks the tag exists and the revert builds | Rehearsal log in `JOURNAL.md` | T15-T17 | S | #18 |
| T19 | Test flight and owner UAT on the lane preview | all | The test-flight checklist | Owner's go | T18 | S | #19 |
| T20 | Merge, live smoke test, and a metrics commit deploys after the merge | N2, N6 | Smoke spec against the live URL; the next analytics commit's run | Both green | T19 | S | #20 |

## Coverage

| Requirement | Tasks |
|---|---|
| R9 | T2, T6, T7 |
| R10 | T3, T8, T14 |
| R11 | T13 |
| R12 | T9, T10, T11, T17 |
| R13 | T2, T9, T10, T11 |
| R14 | T5, T6 |
| R15 | T13 |
| R16 | T4 |
| R17 | T4, T5, T15 |
| R18 | T3, T12 |
| N1, N7, N8, N9 | No task: nothing billed, no model, no runtime controls (PRD); T1 adds only pinned dev tools |
| N2 | T5, T20 |
| N3 | T5, T6, T17 |
| N4 | T15, T16 |
| N5 | T1, T7, T18 |
| N6 | T1, T20 |

Gaps: none. Operations (health check of the live site) is the open Orbit-setup question in STATE; T20 covers the
lane's own live check.

## Task cards (M1)

Shared facts for every card:
- Node 22.12 or later. On Windows, after `npm ci` or `npm install`, run `npm i --no-save @rolldown/binding-win32-x64-msvc@1.2.16`
  so the lock file stays as CI expects. Never commit a lock file that lost Linux bindings: `git diff package-lock.json`
  must show only added packages.
- Fast tests (STATE): `npx astro check && npx astro build && node scripts/check-copy.mjs`. Delete `dist/` before a
  build when the copy gate reports numbers you did not change (stale files).
- The copy gate bans 24-hour times and ISO dates in page text: every visible time is 12-hour ("8:00 AM").
- Commit as the owner (see `CONTRIBUTING`-free repo: author "Manohar Papasani" with the noreply address already in
  `git config`), small commits, pushed after each step.

### T1 Test harness and CI wiring

Serves: N5, N6. Depends on: none. Size: M. Issue: #1

**Files**
- Change: `site/package.json` (devDependencies, scripts), `site/package-lock.json`
- Create: `site/playwright.config.mjs`, `site/tests/screens.json`, `site/tests/unit/ci.test.mjs`,
  `site/tests/e2e/pages.spec.mjs`
- Change: `.github/workflows/site-check.yml`, `site/.gitignore` (`playwright-report/`, `test-results/`)

**Tests that read these files:** none today (the repository has no tests; `scripts/check-copy.mjs` reads `dist/`
only).

**Interfaces**
- `npm run test:unit` = `node --test tests/unit`; `npm run test:e2e` = `playwright test`.
- `tests/screens.json`: `[{ "route": "/", "heading": "A digital workforce that runs itself", "sections": [] }, ...]`,
  one object per route in the Screens table of `architecture.md`, with the exact headings there, except Work, whose
  heading holds a count: write it as `"{repos} repositories. One builder."` and have the spec fill `{repos}` from
  `facts.json` (`repos.total`; read the file for the real key). `sections` stays empty until T8.
- `playwright.config.mjs`: `testDir: "tests/e2e"`, `webServer: { command: "npx astro preview --port 8798", port: 8798,
  reuseExistingServer: false }` (8799 is the dev server's port), `use.baseURL: process.env.BASE_URL || "http://localhost:8798"`; two
  projects: `chromium` with `launchOptions.args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]` and
  `testIgnore: /no-webgl/`, and `no-webgl` with `args: ["--disable-webgl", "--disable-webgl2"]` and
  `testMatch: /no-webgl/` (T5 adds its spec); when `BASE_URL` is set, no `webServer`.

**Steps**
0. `git switch main && git pull --rebase && git switch -c site-3d-lane && git push -u origin site-3d-lane`, then
   `git switch -c t1-test-harness`.
1. Install, exact: `npm install --save-exact --save-dev @playwright/test@1.65.1 @axe-core/playwright@4.14.1`.
   Run `git diff --stat package-lock.json`. Expect: only additions.
2. Write `tests/unit/ci.test.mjs` (run unit tests as `node --test tests/unit/*.test.mjs`: the directory form fails on Windows with Node 22.12): reads the workflow resolved from the test file,
   `new URL("../../../.github/workflows/site-check.yml", import.meta.url)`, as text, and asserts it contains, in this
   order, `npx astro check`, `npx astro build`, `node --test tests/unit`, `npx playwright install --with-deps chromium`,
   `npx playwright test`, `node scripts/check-copy.mjs --grammar`, then `pages deploy`.
   Run `node --test tests/unit`. Expect: `# fail 1` (the unit and Playwright steps are missing).
3. Edit `site-check.yml`: after Build add `Unit tests: node --test tests/unit`; cache `~/.cache/ms-playwright` keyed on
   `site/package-lock.json` with `actions/cache@v4`; `npx playwright install --with-deps chromium`;
   `npx playwright test`; upload `site/playwright-report` with `actions/upload-artifact@v4` when a step fails. Keep the
   copy gate and the preview deploy last. The path filter `site/**` already covers `site/tests/**`.
   Run `node --test tests/unit`. Expect: `# pass 1`, `# fail 0`.
4. Write `tests/screens.json` and `tests/e2e/pages.spec.mjs`: for each route, `page.goto(route)`, the `h1` text equals
   `heading`, the response status is 200.
   Run `npx astro build && npx playwright install chromium && npx playwright test`. Expect: `7 passed`.
5. Add the scripts to `package.json`. Run the fast tests. Expect: 0 errors, 7 pages, copy gate passed.
6. Commit, push the branch, open a pull request into `site-3d-lane`.

**Done check:** `node --test tests/unit && npx playwright test`. Expect: `# fail 0` and `7 passed`; the pull request's
`site-check` run is green.

**A CI change:** step 2's test fails if the steps are removed or reordered.

**Watch out:** `deploy-cloudflare.yml` must not change (N2). Playwright's browser download is about 150 MB: the cache
keeps CI time down. Do not add `@lhci/cli` here (T16).

### T2 Scene data from `teams.json`

Serves: R9, R13. Depends on: T1. Size: S. Issue: #2

**Files**
- Change: `site/src/lib/format.ts` (add `slug`, `hourOf`)
- Change: `site/src/pages/workforce.astro` (use `slug` from `format.ts`), `site/src/pages/index.astro` (line with
  `/workforce#${t.name.toLowerCase()...}` uses `slug`)
- Create: `site/src/lib/scene/data.mjs`, `site/src/data/journey.json`
- Test: `site/tests/unit/scene-data.test.mjs`

**Tests that read these files:** `tests/e2e/pages.spec.mjs` (renders the pages); the copy gate reads the built pages.

**Interfaces**
- `slug(s: string): string` = `s.toLowerCase().replace(/[^a-z0-9]+/g, "-")` (the exact rule both pages use today, so
  every `/workforce#` anchor stays the same).
- `hourOf(shift: string): number | null`: `"08:00 IST · Daily"` → `8`; `"23:30 IST · Daily"` → `23.5`; anything without
  a leading `HH:MM IST` → `null`.
- `buildSceneData(teams, journey) → { version: 1, seed: 2026, teams: [{ id, name, when, crew, hour }], journey }`,
  where `when = shift(team.shift)`, `crew = team.crew.length`. Plain JavaScript (`.mjs`) so `node --test` imports it
  with no build step; it imports nothing from `.ts` files, so `slug`, `shift`, `time12` and `hourOf` are written in
  `data.mjs` and `format.ts` re-exports them (`export { slug, shift, time12, hourOf } from "./scene/data.mjs"`), one
  copy of each rule.
- `journey.json`: `[{ "id": "clock", "name": "Clock", "detail": "Starts the team", "kind": "step" },
  { "id": "team", "name": "Agent team", "detail": "Planner, scouts, writer", "kind": "step" },
  { "id": "critic", "name": "Critic", "detail": "Four judges", "kind": "step" },
  { "id": "linkedin", "name": "LinkedIn", "detail": "Published first", "kind": "step" },
  { "id": "x", "name": "X", "detail": "", "kind": "platform" }, { "id": "bluesky", "name": "Bluesky", ... },
  { "id": "facebook", "name": "Facebook", ... }, { "id": "devto", "name": "Dev.to", ... }]`.

**Steps**
1. Write `scene-data.test.mjs`: `buildSceneData` on the real `teams.json` gives 9 teams and a crew sum of 41; both equal
   `facts.json` `workforce.teams` and `workforce.agents` (never typed numbers); Leadership `hour` 8, Tech learning 23.5,
   Brand analytics `null`; `when` of Leadership is `"Daily, 8:00 AM IST"`; ids equal `slug(name)` and are unique; no
   `when` matches `/\b([01]\d|2[0-3]):[0-5]\d\b(?! [AP]M)/` (no 24-hour time); `journey` has 8 steps in the order above.
   Run `node --test tests/unit`. Expect: fails, `Cannot find module .../scene/data.mjs`.
2. Write `data.mjs` and `journey.json`; re-export from `format.ts`; replace the two inline slug rules.
   Run `node --test tests/unit`. Expect: `# fail 0`.
3. Run the fast tests and `npx playwright test`. Expect: green, 7 passed.

**Done check:** `node --test tests/unit`. Expect: `# fail 0`.

**Watch out:** `facts.json` `workforce` keys: read the file and use the keys that hold the team and agent counts; if
they are named differently from `teams` and `agents`, use the real names and note it in the pull request.
Importing JSON in Node 22: `import x from "./x.json" with { type: "json" }`.

### T3 View registry and `pickView`

Serves: R10, R18. Depends on: T1. Size: S. Issue: #3

**Files**
- Create: `site/src/lib/scene/views.mjs`
- Test: `site/tests/unit/views.test.mjs`

**Tests that read these files:** none.

**Interfaces**
- `VIEWS`: a frozen object with exactly the keys `network`, `dial`, `journey`, `drift`; each value
  `{ camera: [x, y, z], target: [x, y, z], offset: number, dial: 0 | 1, journey: 0 | 1, opacity: number }`.
  Start values: network `camera [0, 0, 16]`, dial `[0, 12, 10]` with `dial: 1`, journey `[0, 2, 12]` with `journey: 1`,
  drift `[0, -2, 22]` with `opacity: 0.7`; T8 tunes them.
- `resolveView(name) → string`: the name if it is a key of `VIEWS`, else `"drift"`.
- `pickView(sections, viewportHeight) → { view, labels, quiet, progress }`. `sections`:
  `[{ top, bottom, view, labels, quiet }]` (screen pixels). `mid = viewportHeight / 2`. Candidates: `top <= mid < bottom`.
  The winner is the candidate with the smallest `bottom - top` (innermost); a tie goes to the later one in the list.
  No candidate: `{ view: "drift", labels: false, quiet: false, progress: 0 }`. `view` passes through `resolveView`.
  `progress = clamp((0.75 * viewportHeight - top) / (0.8 * (bottom - top)), 0, 1)`.

**Steps**
1. Write `views.test.mjs`: one section around the middle wins; outside sections lose; nested sections, the shorter
   wins; `"galaxy"` becomes `drift`; empty list gives drift; progress 0 when `top = 0.75 * vh`, 1 when the section has
   moved up by `0.8 * height`, clamped beyond; `labels` and `quiet` pass through; `VIEWS` has exactly 4 keys.
   Run `node --test tests/unit`. Expect: fails, module not found.
2. Write `views.mjs` (no three.js import, so it stays testable in Node). Run again. Expect: `# fail 0`.

**Done check:** `node --test tests/unit`. Expect: `# fail 0`.

**Watch out:** a section exactly at `bottom === mid` does not contain the middle (half-open range). Zero-height
sections are never candidates.

### T4 Dark only, tokens and layers

Serves: R16, R17. Depends on: T1. Size: M. Issue: #4

**Files**
- Change: `site/src/layouts/Base.astro` (`<html lang="en-GB" data-theme="dark">`)
- Change: `site/src/styles/global.css` (tokens `--glass`, `--veil`; `html.u3d-on` rules; layers)
- Test: `site/tests/e2e/dark.spec.mjs`

**Tests that read these files:** `tests/e2e/pages.spec.mjs`; the copy gate (reads text, not colours).

**Interfaces**
- Tokens in the dark block of `global.css`: `--glass: rgba(20, 32, 52, .78)`, `--veil: rgba(12, 20, 34, .5)`.
- Cards and paper sections set `style="background: var(--card)"` or `var(--paper)` inline (no `.card` class), so the
  see-through look works by **redefining tokens**, never by selectors that fight inline styles:
  `html.u3d-on { --paper: transparent; --card: var(--glass) }`, `html.u3d-on body { background: transparent }`,
  `html.u3d-on .night { background: var(--veil) }`. The blur: `html.u3d-on [style*="var(--card)"] { backdrop-filter:
  blur(10px) }`. Hero diagram (architecture point 5): `html.u3d-on .hero-diagram rect:first-of-type { fill-opacity: .55 }`;
  find the home hero SVG in `src/pages/index.astro` and give it `class="hero-diagram"`. Nothing under `u3d-on` applies
  in this task's tests, because nothing adds the class yet.
- Layers: `#u3d-canvas { position: fixed; inset: 0; z-index: -1 }`, `#u3d-overlay { position: fixed; inset: 0;
  z-index: 1; pointer-events: none }`, `main, footer { position: relative; z-index: 2 }`, header stays `40`.

**Steps**
1. Write `dark.spec.mjs` (JavaScript on: axe runs as a page script, and nothing starts a scene before T5; T5 moves
   this check into the `no-webgl` project so it keeps testing the fallback look): for each route in `screens.json`,
   `html` has `data-theme="dark"`, and `new AxeBuilder({ page }).withRules(["color-contrast"]).analyze()` has 0 violations;
  also with `colorScheme: "light"`, the computed `body` background is the dark token's value.
   Run `npx astro build && npx playwright test dark`. Expect: fails on `data-theme`.
2. Set `data-theme="dark"` in `Base.astro`; add tokens and layers. Build and run again. Expect: passes, or lists
   contrast violations: fix those by using the existing dark tokens, never by changing text.
3. Read the 7 pages in a browser at 1280 and 390 wide (`npx astro preview`) and check nothing became unreadable
   (light-only images, borders). Fast tests. Expect: green.

**Done check:** `npx playwright test dark`. Expect: `7 passed` (or one test per route, all passed).

**A screen:** this is the browser test for every route in the screen list (no roles: all public).

**Watch out:** R8 changes to R16 here (dark for everyone); the light values stay in the file, unused. The theme
toggle, if any exists in `Base.astro`, must not switch to light: search for `data-theme` writes in scripts and remove
them in this task.

### T5 `Universe.astro` and `boot.js`

Serves: R14, R17, N2, N3. Depends on: T2, T4. Size: M. Issue: #5

**Files**
- Create: `site/src/components/Universe.astro`, `site/src/lib/scene/boot.mjs`, `site/src/lib/scene/scene.mjs` (a stub
  in this task: `export async function start(canvas, data, opts) { throw new Error("not built yet") }`)
- Change: `site/src/layouts/Base.astro` (`<Universe />` right after `<body>`'s skip link)
- Change: `site/package.json` (`three@0.187.0` dependency, exact)
- Test: `site/tests/e2e/fallback.spec.mjs`, `site/tests/e2e/no-webgl.spec.mjs`, `site/tests/unit/boot.test.mjs`

**Tests that read these files:** `pages.spec.mjs`, `dark.spec.mjs` (every page now includes `Universe`).

**Interfaces**
- `Universe.astro` renders: `<canvas id="u3d-canvas" aria-hidden="true">`, `<div id="u3d-overlay" aria-hidden="true">`,
  `<script type="application/json" id="u3d-data">` with `buildSceneData(teams, journey)`, and a bundled
  `<script>` that imports `boot.mjs` and calls `boot()`.
- `shouldStart(env) → "start" | "off" | "fallback"` (pure, unit tested): `env = { webgl, saveData }`; `"off"` when
  `saveData` (the visitor chose less data: no 3D, by choice), `"fallback"` when `!webgl`, else `"start"`.
- `boot()`: sets `data-u3d-state="idle"`; `shouldStart` from a real `canvas.getContext("webgl2")` check and
  `navigator.connection?.saveData`; on `"off"` or `"fallback"` sets that state on `<html>` and returns. Else waits for `requestIdleCallback` (timeout
  2000) or `setTimeout(…, 300)` after `load`, sets `loading`, `await import("./scene.mjs")`, calls `start`; on any
  rejection or throw sets `fallback`, removes the canvas, never adds `u3d-on`. Mode from the URL: `?u3d=test` or
  `?u3d=debug`. In test mode sets `window.__u3d = { data, view: null, tier: "full", progress: 0 }` before `start`.

**Steps**
1. `npm install --save-exact three@0.187.0`; check the lock diff (only additions).
2. Write `boot.test.mjs` for `shouldStart` (4 cases: webgl and no data saver, no webgl, data saver, both). Run `node --test tests/unit`. Expect: fails, module not found.
   Write `boot.mjs`. Expect: passes.
3. Write `fallback.spec.mjs`, each on `/` and `/workforce`:
   JavaScript off: `h1` visible, no `html.u3d-on`. WebGL off: in its own file `tests/e2e/no-webgl.spec.mjs`, run by the `no-webgl` project from T1:
   `data-u3d-state="fallback"`, canvas gone, `h1` visible; move T4's contrast check here too. Chunk fails: `page.route("**/scene*.js",
   r => r.fulfill({ status: 500 }))`, state `fallback`. Data saver: `addInitScript` defining `navigator.connection`
   `{ saveData: true }`, state `off` and no request for the scene chunk. With the stub `scene.mjs`, the normal run
   also ends in `fallback`: assert that too, so T6 has a test to turn green.
   Build and run `npx playwright test fallback`. Expect: all pass.
4. Run the copy gate: the `u3d-data` JSON is inside a `<script>` and must not be read as page text. If the gate reports
   it, the gate already skips `script` elements; check `check-copy.mjs` and report rather than change the gate (N6).
5. Fast tests and all Playwright tests. Expect: green.

**Done check:** `npx playwright test fallback && node --test tests/unit`. Expect: all pass.

**Watch out:** Vite 8 (Rolldown) hashes the lazy chunk, expected as `_astro/scene.[hash].js`: after this task's build,
list `dist/_astro/` and use the real name in the route glob (`**/_astro/scene*.js`). `boot` must stay under 3 KB gzipped (T6 adds the size check). The bundled script must not
import `three` statically, or three.js ends up in the boot bundle.

### T6 Scene chunk: the network drawn

Serves: R9, R14, N3. Depends on: T3, T5. Size: M. Issue: #6

**Files**
- Create: `site/src/lib/scene/network.mjs`, `site/src/lib/scene/rng.mjs`
- Change: `site/src/lib/scene/scene.mjs` (real `start`)
- Change: `site/astro.config.mjs` (only if the licence comment is stripped: Vite 8 minifies with Oxc through Rolldown;
  look up its current option for keeping legal comments in the Vite 8 docs, and set it under `vite.build`)
- Test: `site/tests/unit/network.test.mjs`, `site/tests/e2e/scene.spec.mjs`, `site/tests/unit/bundle.test.mjs`

**Tests that read these files:** `fallback.spec.mjs` (its normal-run case flips from `fallback` to `on`: update that
one assertion in this task).

**Interfaces**
- `mulberry32(seed) → () => number` in `rng.mjs`.
- `buildNetwork(data, rand) → { nodes: [{ kind, team, pos: [x, y, z] }], links: [[i, j]] }`, pure (no three.js):
  1 `core`, one `hub` per team, `crew` `agent` nodes per team, 120 `field` nodes (full tier). Agents link to their hub,
  hubs to the core, field nodes to their 2 nearest field neighbours.
- `start(canvas, data, { mode }) → Promise<{ stop() }>`: builds three.js objects (instanced meshes for nodes, one
  `LineSegments` buffer for links, unlit materials, pixel ratio capped at 1.5), renders, then after one more animation
  frame sets `data-u3d-state="on"`, `data-u3d-tier="full"`, adds `html.u3d-on` and fades the canvas in over 0.6 s (no fade when `prefers-reduced-motion: reduce`).
  Idle rotation is off in test mode. Pauses on `visibilitychange` when hidden.

**Steps**
1. `network.test.mjs`: with seed 2026, node counts by kind equal 1, `data.teams.length`, the crew sum, and `FIELD_NODES` (exported from `network.mjs`, 120); every agent links to its team's hub;
   two builds with the same seed give equal positions. Run: fails. Write `rng.mjs`, `network.mjs`. Run: passes.
2. `scene.spec.mjs` with `?u3d=test`, for every route in `screens.json`: `data-u3d-state` becomes `on` within 10 s,
   `html` has class `u3d-on`, `window.__u3d.data` deep-equals the parsed `#u3d-data`, no console errors. Flip the
   normal-run case in `fallback.spec.mjs` to expect `on`. Run: fails. Write `scene.mjs`. Run: passes.
3. `bundle.test.mjs` (runs after a build; skips with a clear message when `dist/` is missing): the boot script is the
   `dist/_astro/*.js` file, or the inline `<script type="module">` in `dist/index.html`, that refers to `u3d-data`; it is at
   most 3 KB gzipped, the chunk containing three.js at most 180 KB gzipped and contains
   `SPDX-License-Identifier: MIT` or `@license`; in every `dist/**/*.html`, the resources the browser fetches (`script[src]`, `link[rel=stylesheet|preload|modulepreload|icon]`,
   `img[src]`, `source[src]`, and `url(...)` in inline `<style>`) are on our own origin or `fonts.googleapis.com` /
   `fonts.gstatic.com`; links (`a[href]`), `canonical`, `og:*` and ld+json are not fetches and are ignored. T17 checks the
   real network log in a browser.
4. Fast tests, unit tests, all Playwright tests. Expect: green. Screenshot `/` at 1280×800 in test mode and attach it to
   the pull request.

**Done check:** `npx astro build && node --test tests/unit && npx playwright test`. Expect: all pass.

**Contract from T5's review:** `start()` cleans up after itself when it fails (stops its loop, removes its listeners, loses its WebGL context) and returns `{ stop }`; it sets `data-u3d-state="on"` itself after the first frame; `boot()` gives it 15 seconds. `bundle.test.mjs` also checks that the boot script does not contain three.js.

**Watch out:** Swiftshader in CI is slow: no frame-rate rule runs in test mode (ADR 0006). `u3d-on` comes only after
the first frame, so a throw during build leaves the page in fallback, never half-drawn. Read three.js 0.187 docs for
`InstancedMesh` and colour management rather than copying the spike (it used 0.160).

### T7 Lane preview and smoke test

Serves: R9, N5. Depends on: T6. Size: S. Issue: #7

**Files**
- Create: `site/tests/e2e/smoke.spec.mjs`

**Tests that read these files:** none.

**Interfaces**
- `BASE_URL=https://site-3d-lane.manoharpapasani.pages.dev npx playwright test smoke` uses the config's `BASE_URL` path
  (no local server).

**Steps**
1. Write `smoke.spec.mjs`: every route answers 200 with its heading; with `?u3d=test` the state reaches `on`.
2. Merge T1 to T6 into `site-3d-lane` and push; the `site-check` run deploys the preview.
3. Run the smoke test against the preview. Expect: all pass. Post the preview link and a phone screenshot for the owner.

**Done check:** the smoke test against the preview URL passes; `site-check` is green on `site-3d-lane`.

**Watch out:** Cloudflare turns `/` in branch names into `-`; the branch has none. Production (`main`) does not change
in this milestone.
