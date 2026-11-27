# PRD: Personal website

Version 1, 2026-11-27. Brief: [brief.md](brief.md). **R1 to R8 are reconstructed** from the live site
*(inferred where marked)*. **R9 to R18 and N1 to N9 are the 3D feature lane**, waiting for the owner's yes.
Numbers marked *(proposed)* are suggestions for the owner to change.

## Users and their jobs
| User | Wants to | So that |
|---|---|---|
| Recruiter or hiring manager | see what the owner builds, fast | they can judge the fit in minutes |
| Possible client or funder | understand how the lab runs, and trust its numbers | they can decide to work with or fund it |
| Engineer | read how the workforce is built | they can learn from it or contribute |

## Requirements: the live site (reconstructed)

| ID | Requirement | State | Acceptance check |
|---|---|---|---|
| R1 | Seven pages: home, workforce, architecture, growth, lab notebook, work, about | built | All 7 build (`astro build`: 7 pages) |
| R2 | Every fact comes from `site/src/data/facts.json`; a page that states another number fails the build | built | Copy gate fact rules |
| R3 | British English with no style, spelling or grammar faults; 12-hour times; no ISO dates in text | built | `check-copy.mjs` (grammar in CI) |
| R4 | Brand numbers update without anyone: the analytics agents commit `data/brand-metrics.json` and the push deploys | built | A metrics commit on `main` deploys |
| R5 | Lab notebook entries are dated and kept in `log.json`; fact rules skip dated entries | built | Copy gate `data-dated` rule |
| R6 | Each push to `main` deploys production; each branch gets a preview | built | The two workflows |
| R7 | Accessible basics: skip link, visible focus, reduced motion respected *(inferred)* | built | Manual check |
| R8 | Light by default, dark when the device asks for it | built; **changed by R16** | Theme tokens in `global.css` |

## Requirements: 3D neural network website (feature lane)

| ID | Requirement | Priority | Acceptance check |
|---|---|---|---|
| R9 | **One 3D neural network behind every page:** a core (the lab), 9 team clusters, one node per agent, glowing links, and a faint field of background nodes. Teams, crew counts and start times come from `teams.json`, never typed into the 3D code | must | On the preview, all 7 pages show the scene; a test checks the scene data equals `teams.json` (9 teams, 41 agents) |
| R10 | **Reusable views (the templates):** a page section picks a view with one attribute (`data-scene="network"`, `dial`, `journey`, `drift`), plus `data-scene-labels` and `data-scene-quiet`. An unknown name falls back to `drift`. A new page or section needs no 3D code | must | Unit tests for view choice and fallback; a views guide in the repo; one page uses views with no script of its own |
| R11 | **Signals:** while idle, posts fire as small pulses along the links, so the network looks alive | must | Visible on the preview; stops under reduced motion (R15) |
| R12 | **Home story in 3D:** the hero shows the network; a stage section places the teams on a 24-hour dial with labels; a stage section plays one post's journey with scroll: clock, team, critic, LinkedIn, then X, Bluesky, Facebook and Dev.to | must | Screenshots of the preview at set scroll points, desktop and phone |
| R13 | **Labels pass the copy rules:** every 3D label's text (team names, start times, journey steps) also exists in the page's HTML, so the copy gate checks it; times are 12-hour | must | Copy gate passes on the built pages with the labels included |
| R14 | **Text first, 3D after:** the page text and layout render without the 3D; the 3D code loads after the page is idle; three.js is served from the site itself, at a pinned version | must | Preview loads with JavaScript blocked and still reads correctly; no third-party script request in the network log |
| R15 | **Reduced motion:** with the device's reduced-motion setting, there is no idle motion; the scene changes only as the visitor scrolls | must | Test with reduced motion on |
| R16 | **Dark only:** every page uses the night look; body text over the scene keeps a contrast of at least 4.5:1 (cards are frosted glass) | must | Contrast check on every page of the preview |
| R17 | **Fallback:** with no WebGL, a failed load, or the browser's data saver on, the page shows the dark design with the existing diagrams and no blank areas | must | Preview with WebGL turned off on 3 browsers |
| R18 | **Only where it fits:** dense content (the workforce team cards, the architecture diagrams, the notebook) gets a quiet view, so the 3D never competes with reading | should | Owner's UAT on each page |

## Non-functional requirements (feature lane)

| ID | Area | Requirement | Acceptance check |
|---|---|---|---|
| N1 | Cost | Rs 0: Cloudflare Pages free plan, no paid 3D service | No new paid account or service |
| N2 | Availability | A 3D failure never breaks a page (R17); the analytics agents' automatic deploys keep working | A metrics commit after the merge deploys and passes the gate |
| N3 | Security and privacy | No new third-party requests (R14); no tracking; the three.js file is pinned and its licence kept | Network log on the preview; licence header present |
| N4 | Performance | Mid-range phone: page text within 2.5 seconds (Largest Contentful Paint) *(proposed)*; Lighthouse mobile performance 80 or more on the home page *(proposed)*; at least 30 frames a second on a mid-range phone and 50 on a laptop *(proposed)*; the scene pauses when the tab is hidden | Lighthouse in CI or by hand on the preview; a frame-rate readout in a debug mode |
| N5 | Release | Built on a lane branch; the preview gets the owner's UAT; a backup tag on `main` before the merge; rollback is reverting the merge commit | Tag exists; revert rehearsed on a branch |
| N6 | Guardrails | The 3D never hides or replaces content that the copy gate checks; the gate stays blocking | Gate output on the merge commit |
| N7 | Governance | Not needed: a static site with no runtime controls; changes go through git and the owner's UAT | - |
| N8 | Token guard | Not needed: the site calls no model | - |
| N9 | Budget guard | Not needed: nothing is billed (N1) | - |

## Out of scope (feature lane)
- A light version of the site (owner: dark only).
- A public template gallery page, and an open-source template kit (later lanes).
- AI-generated video frames, sound, VR, dragging or rotating the scene by hand.
- Changing the site's wording or facts beyond the new stage sections.
- **Must keep:** `facts.json` as the one source, the copy gate, both workflows, the analytics agents' deploys, the
  existing URLs and page titles.

## Success measures
| Measure | Target | By |
|---|---|---|
| Owner's verdict after UAT on their phone and laptop | "better than today's site" | before the merge |
| Gates on the merge commit | type check, build and copy gate all green | the merge |
| Phone speed (N4) | text within 2.5 seconds, Lighthouse 80+ *(proposed)* | the merge |
| Fallback (R17) | no blank areas with WebGL off, on 3 browsers | the merge |

## Risks and assumptions
| Risk or assumption | Impact | How we check or reduce it |
|---|---|---|
| 3D slows phones or drains battery | Visitors leave | N4 budgets; pause when hidden; pixel ratio capped |
| Text over a moving scene is hard to read | The site loses its point | R16 contrast check; quiet views (R18) |
| 3D labels escape the copy gate | Wrong facts or poor English go live | R13 |
| A busy network looks like decoration, not information | Visitors miss the story | Every node is a real team or agent (R9); the owner's UAT |

## Scope changes
| Date | Change | Requirement IDs | Owner's words |
|---|---|---|---|
| 2026-11-27 | 3D website lane added | R9 to R18, N1 to N9; R8 changed by R16 | "Can you build the complete full 3D based website for me?"; "Living neural network"; "Dark only" |

## Open questions
- The proposed numbers in N4 (2.5 seconds, Lighthouse 80, 30 and 50 frames a second).
- Which phone and browsers the owner uses for UAT.
