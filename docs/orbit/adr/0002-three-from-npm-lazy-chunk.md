# ADR 0002: Ship three.js from npm as a lazy chunk on our own domain

Date: 2026-11-27. Status: proposed

## Context
R14 (text first; three.js served from the site at a pinned version), N3 (no third-party requests), N4 (download size).

## Options

| Option | Fit | Monthly cost | Operating effort | Lock-in | On failure |
|---|---|---|---|---|---|
| A. `three` as an exact npm dependency; the scene module loads with a dynamic `import()` after the page is idle, so Vite builds it as its own hashed chunk on our domain | Only the parts we import (137 KB gzipped); version pinned in `package-lock.json`; CI's `npm ci` proves the lock | Rs 0 | Low: an upgrade is one dependency bump | None | Chunk fails to load: fallback (R17) |
| B. A copied vendor file in `public/vendor/` (the spike) | Works, but ships the whole library (about 170 KB gzipped) and upgrades are a manual file swap | Rs 0 | Medium | None | Same fallback |
| C. A CDN (jsDelivr, unpkg) | A third-party request on every visit (breaks R14 and N3) | Rs 0 | Low | The CDN | CDN down: no scene |

## Decision
Option A, with `three@0.187.0` saved exactly (`npm install --save-exact`).

## Why
The smallest download, a pinned version that CI checks, and no other domain. The lock file changes once: the builder
runs `npm install`, and CI's `npm ci` on Linux must pass.

## Revisit when
Astro or Vite stops splitting dynamic imports into their own chunks.
