# Idea to Orbit: plugin feedback (from the personal website)

Gaps found while running this product through the plugin, written so they apply to any
product. Each one is a candidate change to Idea to Orbit.

- 2026-11-27 · ignite · **No question about the look of a product with screens.** Ignite asks "does it have
  screens" but never "what world, mood or visual idea should they have". I picked "space universe" myself; the
  owner asked why, and chose a different idea (a neural network). Better: when there are screens, ask for the
  visual direction as a multiple-choice question, with sketches, before the PRD.
- 2026-11-27 · ignite · **An existing product and a new feature arrive together, and the order is unclear.**
  The skill has an "Existing product" path and a "feature lane" path, but not both at once. Better: say "catch
  up Settings and a short reconstructed requirement list first, then open the lane with new IDs".
- 2026-11-27 · all · **Exploration slid into the real repository.** Concept pages (artifacts) were fine, but the
  next step went straight into code on a branch. Better: name a **spike** in the plugin: allowed before the
  gate, labelled, kept on a local branch, never merged, and logged as a skipped rule.
- 2026-11-27 · ignite (existing product) · **"Run the tests" assumes the toolchain is there.** It took several
  tries (no Node, then a too-old Node, then a lock file without the Windows binary). Better: a step to record
  the toolchain and how to install it without changing lock files, in Settings.
