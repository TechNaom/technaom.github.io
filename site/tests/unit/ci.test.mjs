import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../../../.github/workflows/site-check.yml", import.meta.url),
  "utf8",
);

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
