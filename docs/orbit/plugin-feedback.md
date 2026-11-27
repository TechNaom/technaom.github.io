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
- 2026-11-27 · blueprint · **Adaptive runtime behaviour fights headless CI.** The design lowered quality and fell back on
  slow frame rates; CI browsers have no graphics card, so every "scene draws" test would have seen the fallback. The
  cold read caught it. Better: the blueprint template asks "what does the product change on its own at run time
  (quality, retries, fallbacks), and how does a test pin it?"
- 2026-11-27 · blueprint · **The architecture template has no place for test hooks.** Nothing asked how tests read
  the product's state (here: attributes on `<html>`, a test-mode flag). Better: an "Observability for tests" row in
  Interfaces for products with screens.
- 2026-11-27 · blueprint · **Prior art by measurement, not by reputation.** Measuring bundle sizes (137 KB vs 14 KB)
  and checking the last push (19 months) decided the library ADR. Better: for web products, the prior-art step says
  "measure the cost the user pays (download size, start time), and check activity live".
- 2026-11-27 · blueprint · **Screens need a visual-layers section.** Colours, tokens, z-order and what turns
  see-through were unnamed, and would have hidden the 3D behind opaque sections. Better: a "Visual system" block in the
  Screens section: tokens, layers, and what changes per state.
- 2026-11-27 · blueprint · **A static mockup is not enough for motion.** The skill asks for "one static HTML page";
  for a 3D or animated product the owner needs to see the motion. Better: allow a live mockup when motion is the point.
- 2026-11-27 · all gates · **"Don't stop" has no home.** The owner said "proceed, no need to stop, let's rock" at the
  blueprint gate. The plugin has only "explicit yes per gate". Better: a **Pace** setting in STATE (`ask at every gate` or
  `run on, stop only at`: new vendor or bill, merge to production, UAT), so a standing yes is recorded once and the
  stops that must never be skipped stay named.
- 2026-11-27 · assemble · **The task template assumes a new product.** Its first tasks (budget cap and alerts,
  `.env.example`, walking skeleton deployed) do not fit a feature lane on a live static site with nothing billed.
  Better: for a lane, "deployed" means the promotion environment (here the branch preview), and each standard first
  task is either kept or marked "not needed" with the reason, as the PRD does for NFRs.
- 2026-11-27 · assemble · **The cold read checks cards against the real code, not only the docs.** Point it at the
  files the cards name (key names in data files, what the gate skips, how the bundler names chunks): those are where
  the card's author guessed.
- Evidence so far: the blueprint cold read found 20 gaps (9 would have caused a wrong build) in a design I believed complete; the assemble cold read found 12 more in the M1 cards (6 important: a missing lane branch, a test that could not run, a check that would fail on day one, a port clash), all caught before any code.
