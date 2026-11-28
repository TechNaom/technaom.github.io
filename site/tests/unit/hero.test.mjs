import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../src/styles/global.css", import.meta.url), "utf8");
const home = readFileSync(new URL("../../src/pages/index.astro", import.meta.url), "utf8");

// M1 branch review: `.hero-diagram rect:first-of-type` also matched the first rect inside every <g>.
test("only the hero diagram's frame turns see-through under the scene", () => {
  assert.doesNotMatch(css, /rect:first-of-type/);
  assert.match(css, /html\.u3d-on \.hero-frame \{ fill-opacity: \.55; \}/);
  assert.equal((home.match(/class="hero-frame"/g) || []).length, 1);
  assert.match(home, /<rect class="hero-frame" x="1" y="1" width="558" height="448"/);
});

// M2 branch review (R16): a label sits right next to bright nodes and pulses (#e8f6fc), so its backing must be
// nearly opaque for muted text to keep 4.5:1. Glass (.78) is not enough there.
test("stage labels have a backing of at least 0.9 alpha", () => {
  const rule = css.match(/\.u3d-label \{[^}]*\}/);
  assert.ok(rule, ".u3d-label rule");
  const m = rule[0].match(/background:\s*rgba\(\s*\d+,\s*\d+,\s*\d+,\s*(0?\.\d+|1)\s*\)/);
  assert.ok(m, "an rgba background");
  assert.ok(Number(m[1]) >= 0.9, `alpha ${m[1]}`);
});
