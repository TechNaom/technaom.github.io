# ADR 0003: The templates are views a section picks with a data attribute

Date: 2026-11-27. Status: proposed

## Context
R10: any section picks a view with one attribute, unknown names fall back, and new pages need no 3D code. R18: dense
content gets a quiet view.

## Options

| Option | Fit | Monthly cost | Operating effort | Lock-in | On failure |
|---|---|---|---|---|---|
| A. `data-scene` with one of `network`, `dial`, `journey`, `drift`, plus `data-scene-labels` and `data-scene-quiet`, on any element; one registry of views; the element crossing the middle of the screen wins (the spike's approach) | Works on any page, Markdown included; no code per page | Rs 0 | Low | None | Unknown name: `drift`, with one console warning in debug mode |
| B. An Astro wrapper, `<Scene view="dial">`, around each section | Typed props, but every section must be wrapped, and MDX entries need imports | Rs 0 | Medium | Astro | Build error on a wrong prop |
| C. A script per page that drives the scene | Full control, but 3D code on every page (breaks R10) | Rs 0 | High | None | One page's bug only |

## Decision
Option A. The registry is a plain object in `site/src/lib/scene/views.js`; the choice is a pure function,
`pickView(sections, viewportHeight)` (contract in architecture.md, Implementation decisions, point 12), so it is unit tested.

## Why
The least code per page, and it works wherever the site renders HTML. We give up type checking of the view name;
the unit tests and the fallback cover it.

## Revisit when
We need views with parameters (for example zooming into one chosen team); then add B on top of A.
