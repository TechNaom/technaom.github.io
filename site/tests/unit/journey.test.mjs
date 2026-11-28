// R12, R13: one post's journey, and one source for its text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import journey from "../../src/data/journey.json" with { type: "json" };
import { journeyAt, journeyPoints } from "../../src/lib/scene/journey.mjs";

test("journeyAt: progress 0 is the first step, 1 the last, clamped outside", () => {
  assert.deepEqual(journeyAt(0, 8), { step: 0, t: 0 });
  assert.deepEqual(journeyAt(1, 8), { step: 7, t: 0 });
  assert.deepEqual(journeyAt(-1, 8), { step: 0, t: 0 });
  assert.deepEqual(journeyAt(2, 8), { step: 7, t: 0 });
  const mid = journeyAt(0.5, 8); // 3.5 of 7 segments
  assert.equal(mid.step, 3);
  assert.ok(Math.abs(mid.t - 0.5) < 1e-9);
});

test("journeyPoints: one point per step, left to right on a gentle arc in front of the network", () => {
  const pts = journeyPoints(journey);
  assert.equal(pts.length, journey.length);
  assert.ok(Math.abs(pts[0][0] + 8) < 1e-9 && Math.abs(pts.at(-1)[0] - 8) < 1e-9);
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i][0] > pts[i - 1][0]);
  for (const [, y, z] of pts) assert.ok(y >= -1 && y <= 1 && z === 2);
});

const page = new URL("../../dist/index.html", import.meta.url);
test("every journey text is on the built home page, from journey.json only", { skip: existsSync(page) ? false : "run `npx astro build` first" }, () => {
  const html = readFileSync(page, "utf8");
  for (const s of journey) {
    assert.ok(html.includes(`>${s.name}<`), `name ${s.name}`);
    if (s.detail) assert.ok(html.includes(s.detail), `detail ${s.detail}`);
  }
  // The M1 review found a second copy that disagreed with journey.json.
  assert.ok(!html.includes("Four slots a day"));
  assert.ok(!html.includes("Then four more platforms"));
});
