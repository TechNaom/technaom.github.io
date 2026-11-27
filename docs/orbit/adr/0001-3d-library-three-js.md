# ADR 0001: Draw the network with three.js

Date: 2026-11-27. Status: proposed

## Context
R9 to R12 need a live 3D network (points, links, glow, moving signals); N4 limits what a phone downloads; N3 and
R14 forbid third-party requests. Facts checked live on 2026-11-27 (npm and GitHub). Sizes are gzipped bundles of
only the parts our scene imports, measured with esbuild.

## Options

| Option | Fit | Monthly cost | Operating effort | Lock-in | On failure |
|---|---|---|---|---|---|
| A. [three.js](https://github.com/mrdoob/three.js) 0.187.0 (MIT, 119.5k stars, pushed 2026-11-27) | Points, lines, instanced meshes, sprites and fog built in; the spike already works with it; 137 KB | Rs 0 | Low: one well-known library, frequent releases | Low (plain WebGL underneath) | Load or WebGL failure: fallback (R17) |
| B. [OGL](https://github.com/oframe/ogl) 1.0.11 (Unlicense, 4.8k stars, last push 2025-04-13) | Tiny (14 KB), but every effect (glow, lines, points) is our own shader code | Rs 0 | High: we own the shaders; no push for 19 months | Low | Same fallback, but bugs are ours to fix |
| C. [Babylon.js](https://github.com/BabylonJS/Babylon.js) 9.38.0 (Apache-2.0, 26.5k stars) | A full game engine: more than a background needs, larger download | Rs 0 | Medium | Medium (its own scene model) | Same fallback |
| D. A hosted 3D tool (for example Spline embeds) | Drawn by hand, so not built from `teams.json` (R9); loads from another domain (R14, N3) | Free tier, paid above | Low | High (the scene lives in their account) | Their outage blanks the scene |

## Decision
Option A: three.js, pinned at 0.187.0.

## Why
It meets every requirement with the least code of our own, and it is the most active option. We give up about
123 KB of download against OGL; ADR 0006 keeps that inside the phone budget by loading it after the text.

## Revisit when
The 3D download breaks N4 on real phones, or three.js changes its licence.
