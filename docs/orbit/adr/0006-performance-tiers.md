# ADR 0006: One light scene with quality tiers, loaded after the text

Date: 2026-11-27. Status: proposed

## Context
N4 (text within 2.5 seconds, Lighthouse 80 or more, 30 frames a second on a mid-range phone and 50 on a laptop),
R14, R15, R17. The live network has about 60 nodes (core, 9 hubs, 41 agents, journey steps), their links, and a
background field.

## Options

| Option | Fit | Monthly cost | Operating effort | Lock-in | On failure |
|---|---|---|---|---|---|
| A. A live scene built for low cost: instanced meshes for nodes, one line buffer for all links, unlit materials and additive glow sprites, pixel ratio capped at 1.5, a seeded layout; loaded when the page is idle; two tiers, **full** and **lite** (fewer background nodes, no glow), switching to lite when the average frame time over 2 seconds passes 36 ms (just under 28 frames a second, so a phone capped at 30 in low-power mode does not trip it), measured only after the first second and never while the tab is hidden; no 3D at all with the data saver on (R17); paused when the tab is hidden; `?u3d=test` pins the tier and turns the automatic fallback off, for CI browsers without a graphics card | Live data (R9), smooth on phones, stable screenshots | Rs 0 | Medium | None | Still too slow on lite: the scene stops and the fallback shows (R17) |
| B. One fixed quality | Simpler, but either too slow on phones or too plain on laptops | Rs 0 | Low | None | Phones drop frames |
| C. Pre-rendered frames or video, played by scroll | Smooth anywhere, but megabytes of images and no live data from `teams.json` | Rs 0 | High: re-render on every team change | None | Heavy pages miss N4 |

## Decision
Option A.

## Why
The network stays live and true to the data while phones stay smooth. We give up some richness on slow devices.

## Revisit when
Real-device tests in test flight miss N4 on lite.
