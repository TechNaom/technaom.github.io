import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raw = readFileSync(
  new URL("../../../.github/workflows/site-check.yml", import.meta.url),
  "utf8",
);
// Comment lines do not run: a step that is commented out must not count.
const workflow = raw
  .split(/\r?\n/)
  .filter((line) => !/^\s*#/.test(line))
  .join("\n");

test("site-check runs every gate, in order, with the preview deploy last", () => {
  const steps = [
    "npx astro check",
    "npx astro build",
    "node --test tests/unit",
    "npx playwright install --with-deps chromium",
    "npx playwright test",
    "node scripts/check-copy.mjs --grammar",
    "pages deploy",
  ];
  let from = 0;
  for (const step of steps) {
    const at = workflow.indexOf(step, from);
    assert.notEqual(at, -1, `missing or out of order: ${step}`);
    from = at + step.length;
  }
});

test("no gate can fail quietly, and the job has a time limit", () => {
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
  assert.match(workflow, /timeout-minutes:\s*\d+/);
});

test("a cached Playwright browser skips the full install but still gets its system packages", () => {
  assert.match(workflow, /id:\s*pw\b/);
  assert.match(workflow, /restore-keys:/);
  assert.match(workflow, /if:\s*steps\.pw\.outputs\.cache-hit != 'true'\s*\n\s*run: npx playwright install --with-deps chromium/);
  assert.match(workflow, /if:\s*steps\.pw\.outputs\.cache-hit == 'true'\s*\n\s*run: npx playwright install-deps chromium/);
});
