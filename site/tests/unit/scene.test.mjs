// The start() contract with boot (T5 review, T6 code check): "on" only after a first frame on a live canvas,
// full clean-up when anything fails or boot gives up, and no redraw loop for a still scene.
import { test } from "node:test";
import assert from "node:assert/strict";
import teams from "../../src/data/teams.json" with { type: "json" };
import journey from "../../src/data/journey.json" with { type: "json" };
import { buildSceneData } from "../../src/lib/scene/data.mjs";
import { start } from "../../src/lib/scene/scene.mjs";

const data = buildSceneData(teams, journey);

function listeners() {
  const map = new Map();
  return {
    map,
    addEventListener: (t, fn) => map.set(t, [...(map.get(t) || []), fn]),
    removeEventListener: (t, fn) => map.set(t, (map.get(t) || []).filter((f) => f !== fn)),
    fire: (t) => (map.get(t) || []).forEach((fn) => fn()),
    count: () => [...map.values()].reduce((n, l) => n + l.length, 0),
  };
}

function fakePage({ renderThrows = false } = {}) {
  const attrs = {};
  const classes = new Set();
  const frames = new Map();
  let nextId = 1;
  const winL = listeners();
  const docL = listeners();
  const win = {
    devicePixelRatio: 3, innerWidth: 800, innerHeight: 600,
    requestAnimationFrame: (fn) => (frames.set(nextId, fn), nextId++),
    cancelAnimationFrame: (id) => frames.delete(id),
    matchMedia: () => ({ matches: false }),
    addEventListener: winL.addEventListener, removeEventListener: winL.removeEventListener,
  };
  const doc = {
    hidden: false, defaultView: win,
    documentElement: {
      setAttribute: (k, v) => (attrs[k] = v),
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    },
    addEventListener: docL.addEventListener, removeEventListener: docL.removeEventListener,
  };
  const canvas = { ownerDocument: doc, isConnected: true, style: {} };
  const renderer = {
    renders: 0, lost: 0, disposed: 0, pixelRatio: null,
    setPixelRatio(r) { this.pixelRatio = r; },
    setSize() {},
    render() { if (renderThrows) throw new Error("shader failed"); this.renders++; },
    dispose() { this.disposed++; },
    forceContextLoss() { this.lost++; },
  };
  /** Run the animation frames queued so far, once. */
  const flush = () => { const due = [...frames]; frames.clear(); due.forEach(([, fn]) => fn(16)); };
  return { win, doc, canvas, renderer, attrs, classes, frames, flush, winL, docL, makeRenderer: () => renderer };
}

const tick = () => new Promise((r) => setImmediate(r));

test("a render that throws: start rejects, nothing is on, listeners gone, context lost", async () => {
  const p = fakePage({ renderThrows: true });
  await assert.rejects(start(p.canvas, data, { mode: "test", makeRenderer: p.makeRenderer }), /shader failed/);
  assert.notEqual(p.attrs["data-u3d-state"], "on");
  assert.equal(p.classes.has("u3d-on"), false);
  assert.equal(p.winL.count() + p.docL.count(), 0);
  assert.equal(p.renderer.lost, 1);
  assert.equal(p.frames.size, 0);
});

test("a normal start: on after the first frame, pixel ratio capped, stop() is safe twice", async () => {
  const p = fakePage();
  const pending = start(p.canvas, data, { mode: "test", makeRenderer: p.makeRenderer });
  assert.notEqual(p.attrs["data-u3d-state"], "on", "not on before a frame");
  p.flush();
  const { stop } = await pending;
  assert.equal(p.attrs["data-u3d-state"], "on");
  assert.equal(p.attrs["data-u3d-tier"], "full");
  assert.equal(p.classes.has("u3d-on"), true);
  assert.equal(p.renderer.pixelRatio, 1.5);
  stop();
  stop();
  assert.equal(p.winL.count() + p.docL.count(), 0);
  assert.equal(p.renderer.lost, 1);
  assert.equal(p.frames.size, 0);
});

test("boot gives up first (signal aborted) before the frame: rejects, never on, cleaned up", async () => {
  const p = fakePage();
  const ac = new AbortController();
  const pending = start(p.canvas, data, { mode: "test", makeRenderer: p.makeRenderer, signal: ac.signal });
  ac.abort();
  p.flush();
  await assert.rejects(pending);
  assert.notEqual(p.attrs["data-u3d-state"], "on");
  assert.equal(p.classes.has("u3d-on"), false);
  assert.equal(p.renderer.lost, 1);
  assert.equal(p.winL.count() + p.docL.count(), 0);
});

test("the canvas was removed before the frame: rejects, never on", async () => {
  const p = fakePage();
  const pending = start(p.canvas, data, { mode: "test", makeRenderer: p.makeRenderer });
  p.canvas.isConnected = false;
  p.flush();
  await assert.rejects(pending);
  assert.equal(p.classes.has("u3d-on"), false);
  assert.equal(p.renderer.lost, 1);
});

test("a still scene (test mode) does not redraw every frame, but redraws on resize", async () => {
  const p = fakePage();
  const pending = start(p.canvas, data, { mode: "test", makeRenderer: p.makeRenderer });
  p.flush();
  const { stop } = await pending;
  for (let i = 0; i < 5; i++) { p.flush(); await tick(); }
  const still = p.renderer.renders;
  p.flush();
  assert.equal(p.renderer.renders, still, "no redraw without a change");
  assert.equal(p.frames.size, 0, "no loop queued");
  p.winL.fire("resize");
  p.flush();
  assert.ok(p.renderer.renders > still, "a resize redraws");
  stop();
});

test("a moving scene (normal mode) keeps a loop and pauses while the tab is hidden", async () => {
  const p = fakePage();
  const pending = start(p.canvas, data, { mode: "normal", makeRenderer: p.makeRenderer });
  p.flush();
  const { stop } = await pending;
  p.flush();
  assert.ok(p.frames.size > 0, "loop queued");
  p.doc.hidden = true;
  p.flush();
  assert.equal(p.frames.size, 0, "paused when hidden");
  p.doc.hidden = false;
  p.docL.fire("visibilitychange");
  assert.ok(p.frames.size > 0, "resumed when visible");
  stop();
  assert.equal(p.frames.size, 0);
});
