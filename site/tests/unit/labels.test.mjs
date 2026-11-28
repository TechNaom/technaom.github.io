// R12, R13: placing a stage's labels on screen (pure helpers).
import { test } from "node:test";
import assert from "node:assert/strict";
import { toScreen, declutter, overlaps } from "../../src/lib/scene/labels.mjs";

test("toScreen: the centre of clip space is the middle of the screen; behind the camera or off screen is hidden", () => {
  assert.deepEqual(toScreen({ x: 0, y: 0, z: 0.5 }, 800, 600), { x: 400, y: 300, visible: true });
  assert.deepEqual(toScreen({ x: -1, y: 1, z: 0 }, 800, 600), { x: 0, y: 0, visible: true });
  assert.equal(toScreen({ x: 0, y: 0, z: 1.2 }, 800, 600).visible, false);
  assert.equal(toScreen({ x: 1.5, y: 0, z: 0.5 }, 800, 600).visible, false);
});

test("overlaps finds boxes that touch, and only those", () => {
  const a = { x: 0, y: 0, w: 100, h: 20 }, b = { x: 90, y: 10, w: 50, h: 20 }, c = { x: 300, y: 300, w: 10, h: 10 };
  assert.deepEqual(overlaps([a, b, c]), [[0, 1]]);
});

test("declutter: the first box stays; a later overlapping box moves outward until clear", () => {
  const boxes = [
    { x: 500, y: 300, w: 120, h: 30 },
    { x: 510, y: 310, w: 120, h: 30 },
  ];
  const out = declutter(boxes, { step: 24, centre: { x: 400, y: 300 } }); // 6 moves of 24 px clear a 110 px overlap
  assert.deepEqual({ x: out[0].x, y: out[0].y }, { x: 500, y: 300 });
  assert.equal(out[1].hidden, false);
  assert.deepEqual(overlaps(out.filter((b) => !b.hidden)), []);
  assert.ok(out[1].x > 510, "moved away from the centre");
});

test("declutter: a box that cannot get clear in 6 moves is hidden, never left overlapping", () => {
  const big = { x: 0, y: 0, w: 2000, h: 2000 };
  const out = declutter([big, { x: 10, y: 10, w: 20, h: 20 }], { step: 5, centre: { x: 0, y: 0 } });
  assert.equal(out[1].hidden, true);
});
