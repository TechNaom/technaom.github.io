// N4: the frame-rate readout and the morph's buffers (T15a).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMeter } from "../../src/lib/scene/fps.mjs";
import { createMorph, ease } from "../../src/lib/scene/motion.mjs";

test("meter: the average of frames inside the window; older frames drop out; reset empties it", () => {
  const m = createMeter(2000);
  for (let i = 0; i < 60; i++) m.add(16);
  assert.equal(m.average(), 16);
  for (let i = 0; i < 125; i++) m.add(40); // 5000 ms of 40 ms frames: the 16 ms ones are long gone
  assert.equal(m.average(), 40);
  m.reset();
  assert.equal(m.average(), 0);
  assert.equal(m.fps(), 0);
  m.add(20);
  assert.equal(m.fps(), 50);
});

test("ease: 0 at 0, 1 at 1, half way at 0.5", () => {
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.equal(ease(0.5), 0.5);
});

test("morph: writes into its own buffer, never into the one it started from", () => {
  const m = createMorph(3);
  const from = new Float32Array([0, 0, 0]);
  const to = new Float32Array([10, 20, 30]);
  m.begin(from, to);
  from[0] = 99; // the caller's array may change: the morph keeps its own copy
  const out = m.at(0.5);
  assert.deepEqual([...out], [5, 10, 15]);
  assert.notEqual(out, from);
  // A new move that starts from the morph's own output (interrupted half way) must not alias it.
  m.begin(out, new Float32Array([0, 0, 0]));
  assert.deepEqual([...m.at(0)], [5, 10, 15]);
  assert.deepEqual([...m.at(1)], [0, 0, 0]);
  assert.equal(m.at(0.25), m.at(0.75), "one output buffer, reused: no allocation per frame");
});
