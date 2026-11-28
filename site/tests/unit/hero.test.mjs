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
