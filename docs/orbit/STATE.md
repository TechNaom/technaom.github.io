# Product state: Personal website (manoharpapasani.pages.dev)

Started: 2026-11-27 (joined Idea to Orbit as an existing, live product; the site launched on 2026-10-26)

## Current

- Stage: orbit (live) *(inferred: the site is built and deployed; Ignite and Blueprint are reconstructed, waiting for the owner's yes)*
- Status: waiting for approval
- Profile: startup (Cloudflare Pages free plan, nothing billed)

## Settings

- Code host: github, TechNaom/technaom.github.io *(read from the remote)*
- Work branch: a branch per lane, merged into `main` *(inferred)*
- Release branch: main (every push deploys production, `.github/workflows/deploy-cloudflare.yml`)
- Promotion: branch push → preview at `https://<branch>.manoharpapasani.pages.dev` (`site-check.yml`) → owner UAT → merge to `main`
- Builders: subagents
- Unit and browser tests (from T1): `cd site && node --test tests/unit/*.test.mjs && npx playwright test` (build first; about 1 minute)
- Fast tests: `cd site && npx astro check && npx astro build && node scripts/check-copy.mjs` (about 45 seconds on 2026-11-27, all green: 0 type errors, 7 pages, copy gate passed)
- Full suite: the fast tests plus `node scripts/check-copy.mjs --grammar` (LanguageTool, runs in CI on branches)
- CI: GitHub Actions; `site-check.yml` on every branch push, `deploy-cloudflare.yml` on `main`
- Toolchain note: on Windows run Node from a `C:\` working directory (uppercase): a `c:\` one breaks `astro build` ("No cached compile metadata"). Edit files as UTF-8 (PowerShell's `Get-Content`/`Set-Content` re-encode them). Node 22.12 or later. On Windows the lock file has no `@rolldown/binding-win32-x64-msvc`; install it with `npm i --no-save` so the lock file stays as CI expects.

## Gates

| Stage | Status | Approved by | Date |
|---|---|---|---|
| ignite | reconstructed, waiting for approval | | |
| blueprint | reconstructed later (architecture.md not written yet) | | |
| assemble | n/a (built before joining) | | |
| build | n/a (built before joining) | | |
| test-flight | n/a | | |
| launch | live since 2026-10-26 | | |
| orbit | not set up in Idea to Orbit terms | | |

## In flight

- Feature lane: **3D neural network website** (R9 to R18 in `prd.md`). Ignite approved 2026-11-27 ("Then proceed, go ahead"). Blueprint approved 2026-11-27 ("Yeah, that should be fine. We are not depending on any vendor... proceed. No need to stop."): mockup agreed, no new vendor, account or bill, Rs 0. Step: **assemble** done: `tasks.md` (3 milestones, 20 tasks, M1 cards), cold read answered (12 points, fixed on the cards). Assemble approved under the owner's standing "no need to stop". Issues #1 to #20 created. Step: **build**. T1 to T3 done (PRs #21 to #23 into `site-3d-lane`); T5 done (PR #25); T6 done (PR #26); T7 done (PR #27): the lane preview https://site-3d-lane.manoharpapasani.pages.dev passes the smoke test. M1 built and branch-reviewed (fixes PR #28). M2 cards written and cold-read twice. T8 done (PR #29); T9 done (PR #30); T10 done (PR #31). Next: T11 (labels overlay). Owner 2026-11-28: lean mode; one free-worker trial on T14. Note for T8: on a phone, nodes sit over the intro text and buttons. Notes for T8 from T6's re-check: redraw after `webglcontextrestored`; boot's fallback should also remove `data-u3d-tier`.
- Spike: local branch `site-3d`, commit `a68df31` (a space-universe 3D background on all 7 pages; check, build and copy gate pass). Reference only, never merged; paused until the lane reaches Build.

## Open questions

- The copy gate let mojibake (`â†’`) through on a page. Add a check for broken encoding? (blocks: nothing in the lane; a separate fix)

- The site says "four posts a day", but the 8 AM and 12 PM slots have been paused on purpose since 2026-11-24. Change `facts.json`? (blocks: nothing in the 3D lane; a separate fix)
- Which real devices does the owner use for UAT (phone model, browsers)? (blocks: test-flight of the 3D lane)
- Orbit setup for the live site (health check, alerts) has not been reviewed. (blocks: nothing now)

## Log

- 2026-11-28 3D lane T10 done (PR #31): journey stage, step arc and pulse by scroll; one source for the journey text; the arc clears the stage card (journey camera 16, offset 5.5). 58 unit + 56 browser tests.
- 2026-11-28 3D lane T9 done (PR #30): home dial stage, teams on a 24-hour dial, labels in the HTML (copy gate reads them), nodes morph between views. 55 unit + 54 browser tests.
- 2026-11-28 3D lane T8 done (PR #29): camera per view from data-scene; phones stand back 1.6x and look 5 units higher so the network clears the hero text; context lost falls back. 50 unit + 51 browser tests.
- 2026-11-28 3D lane T7 done (PR #27): smoke test against the lane preview, 7 pass; fails against production (no 3D), as it should.
- 2026-11-28 3D lane T6 done (PR #26): the network draws (instanced nodes, one line buffer, 132 KB gz chunk); boot aborts a late start; 42 unit + 44 browser tests.
- 2026-11-28 3D lane T5 done (PR #25): boot decides, waits for idle, probes WebGL after idle, loads the lazy chunk, and every failure ends in fallback. 24 unit + 37 browser tests.
- 2026-11-28 3D lane T2, T3 done (lean: built solo, one combined check, 56k agent tokens for both); T4 built, 3 fixes in review, PR #24.
- 2026-11-28 Scope change: governance, token guard, budget guard and evals apply to the AI builders (N7 to N10). Token ledger started; lean build rules from T2.
- 2026-11-28 3D lane T1 done: test harness and CI (PR #21, merged into the lane). Tests 0 → 3 unit + 7 browser. Five fixes made in review (JOURNAL).
- 2026-11-27 3D lane: blueprint approved by the owner (no new vendor, account or bill; Rs 0; mockup agreed). The owner asked not to stop between stages ("No need to stop. Let's rock"); merges to `main` and the UAT still wait for the owner.

- 2026-11-27 3D lane blueprint: architecture.md and ADRs 0001 to 0006 (three.js 0.187.0 from npm as a lazy chunk, views as data attributes, labels in HTML, node:test + Playwright + axe + Lighthouse CI, quality tiers). Mockup published for the owner. No new vendor, account or bill.
- 2026-11-27 3D lane: ignite approved by the owner ("Then proceed, go ahead"). Blueprint started. The N4 numbers stay *(proposed)* until the owner changes them.
- 2026-11-27 Owner chose for the 3D lane: all 7 pages, reusable views as the templates, a living neural network (not space), dark only, no deadline, quality first.
- 2026-11-27 Joined Idea to Orbit; documents reconstructed from the code; 3D feature lane started at ignite.
