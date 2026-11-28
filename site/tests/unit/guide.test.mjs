// R10: the views guide stays true to the registry, and a page uses views with no script of its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { VIEWS } from "../../src/lib/scene/views.mjs";

const guideUrl = new URL("../../src/lib/scene/README.md", import.meta.url);

test("the guide exists and its view table lists exactly the registry's views", () => {
  assert.ok(existsSync(guideUrl), "src/lib/scene/README.md");
  const guide = readFileSync(guideUrl, "utf8");
  // Table rows whose first cell is a view name in backticks: | `network` | ... |
  const named = [...guide.matchAll(/^\|\s*`([a-z]+)`\s*\|/gm)].map((m) => m[1]);
  assert.deepEqual([...named].sort(), Object.keys(VIEWS).sort());
});

test("the guide names the three attributes", () => {
  const guide = readFileSync(guideUrl, "utf8");
  for (const attr of ["data-scene", "data-scene-labels", "data-scene-quiet"]) assert.ok(guide.includes(attr), attr);
});

test("guard: the growth page has no script of its own and gets its view from PageHero", () => {
  const page = readFileSync(new URL("../../src/pages/growth.astro", import.meta.url), "utf8");
  const hero = readFileSync(new URL("../../src/components/PageHero.astro", import.meta.url), "utf8");
  assert.doesNotMatch(page, /<script/);
  assert.match(page, /<PageHero/);
  assert.match(hero, /data-scene="network"/);
});
