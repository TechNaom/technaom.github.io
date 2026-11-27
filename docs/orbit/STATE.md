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
- Fast tests: `cd site && npx astro check && npx astro build && node scripts/check-copy.mjs` (about 45 seconds on 2026-11-27, all green: 0 type errors, 7 pages, copy gate passed)
- Full suite: the fast tests plus `node scripts/check-copy.mjs --grammar` (LanguageTool, runs in CI on branches)
- CI: GitHub Actions; `site-check.yml` on every branch push, `deploy-cloudflare.yml` on `main`
- Toolchain note: Node 22.12 or later. On Windows the lock file has no `@rolldown/binding-win32-x64-msvc`; install it with `npm i --no-save` so the lock file stays as CI expects.

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

- Feature lane: **3D neural network website** (R9 to R18 in `prd.md`). Ignite approved 2026-11-27 ("Then proceed, go ahead"). Blueprint approved 2026-11-27 ("Yeah, that should be fine. We are not depending on any vendor... proceed. No need to stop."): mockup agreed, no new vendor, account or bill, Rs 0. Step: **assemble** done: `tasks.md` (3 milestones, 20 tasks, M1 cards), cold read answered (12 points, fixed on the cards). Assemble approved under the owner's standing "no need to stop". Issues #1 to #20 created. Step: **build** T1 (#1).
- Spike: local branch `site-3d`, commit `a68df31` (a space-universe 3D background on all 7 pages; check, build and copy gate pass). Reference only, never merged; paused until the lane reaches Build.

## Open questions

- The site says "four posts a day", but the 8 AM and 12 PM slots have been paused on purpose since 2026-11-24. Change `facts.json`? (blocks: nothing in the 3D lane; a separate fix)
- Which real devices does the owner use for UAT (phone model, browsers)? (blocks: test-flight of the 3D lane)
- Orbit setup for the live site (health check, alerts) has not been reviewed. (blocks: nothing now)

## Log

- 2026-11-27 3D lane: blueprint approved by the owner (no new vendor, account or bill; Rs 0; mockup agreed). The owner asked not to stop between stages ("No need to stop. Let's rock"); merges to `main` and the UAT still wait for the owner.

- 2026-11-27 3D lane blueprint: architecture.md and ADRs 0001 to 0006 (three.js 0.187.0 from npm as a lazy chunk, views as data attributes, labels in HTML, node:test + Playwright + axe + Lighthouse CI, quality tiers). Mockup published for the owner. No new vendor, account or bill.
- 2026-11-27 3D lane: ignite approved by the owner ("Then proceed, go ahead"). Blueprint started. The N4 numbers stay *(proposed)* until the owner changes them.
- 2026-11-27 Owner chose for the 3D lane: all 7 pages, reusable views as the templates, a living neural network (not space), dark only, no deadline, quality first.
- 2026-11-27 Joined Idea to Orbit; documents reconstructed from the code; 3D feature lane started at ignite.
