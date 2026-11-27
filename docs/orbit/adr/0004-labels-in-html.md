# ADR 0004: 3D labels are real HTML that the copy gate and screen readers read

Date: 2026-11-27. Status: proposed

## Context
R13: every label's text must pass the copy gate, which reads only the built HTML. The spike made its labels in
JavaScript, so the gate never saw them.

## Options

| Option | Fit | Monthly cost | Operating effort | Lock-in | On failure |
|---|---|---|---|---|---|
| A. Astro renders each stage's labels as a list in the HTML (`<ol class="u3d-labels">`, one `<li data-anchor="team:leadership">` per label) from `teams.json` and the journey steps; the scene only moves them | The gate checks them; screen readers read a list; no words live in JavaScript | Rs 0 | Low | None | No 3D: the list shows as a plain list in the stage card |
| B. Labels made in JavaScript (the spike), plus a unit test of their text | The gate's rules would have to be copied into the test | Rs 0 | Medium | None | Text can drift from the gate's rules |
| C. Text drawn into the canvas | Unreadable by the gate and by screen readers | Rs 0 | Medium | None | - |

## Decision
Option A.

## Why
One source of truth for words (the HTML), checked by the gate that already exists. We give up a little freedom in
how labels look, because they are page elements.

## Revisit when
The number of labels grows past what positioning page elements handles smoothly (about 200).
