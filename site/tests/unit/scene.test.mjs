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
  const canvasL = listeners();
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
    hidden: false, defaultView: win, sections: [],
    querySelectorAll(sel) { return sel === "[data-scene]" ? this.sections : []; },
    documentElement: {
      setAttribute: (k, v) => (attrs[k] = v),
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    },
    addEventListener: docL.addEventListener, removeEventListener: docL.removeEventListener,
  };
  const canvas = { ownerDocument: doc, isConnected: true, style: {}, addEventListener: canvasL.addEventListener, removeEventListener: canvasL.removeEventListener };
  const renderer = {
    renders: 0, lost: 0, disposed: 0, pixelRatio: null,
    setPixelRatio(r) { this.pixelRatio = r; },
    setSize() {},
    render() { if (renderThrows) throw new Error("shader failed"); this.renders++; },
    dispose() { this.disposed++; },
    forceContextLoss() { this.lost++; canvasL.fire("webglcontextlost"); }, // a real browser fires it too
  };
  /** Run the animation frames queued so far, once. */
  const flush = () => { const due = [...frames]; frames.clear(); due.forEach(([, fn]) => fn(16)); };
  return { win, doc, canvas, canvasL, renderer, attrs, classes, frames, flush, winL, docL, makeRenderer: () => renderer };
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

const section = (view, top, bottom) => {
  const el = {
    rect: { top, bottom },
    getAttribute: (k) => (k === "data-scene" ? view : null),
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ ...el.rect }),
  };
  return el;
};

test("losing the WebGL context stops the scene and calls onLost once", async () => {
  const p = fakePage();
  let lost = 0;
  const pending = start(p.canvas, data, { mode: "test", makeRenderer: p.makeRenderer, onLost: () => lost++ });
  p.flush();
  await pending;
  p.canvasL.fire("webglcontextlost");
  assert.equal(lost, 1);
  assert.equal(p.winL.count() + p.docL.count() + p.canvasL.count(), 0);
  assert.equal(p.renderer.lost, 1);
  assert.equal(p.frames.size, 0);
});

test("the section in the middle of the screen sets data-u3d-view; scrolling changes it", async () => {
  const p = fakePage();
  p.doc.sections = [section("network", 0, 700), section("dial", 700, 1600)];
  const pending = start(p.canvas, data, { mode: "test", makeRenderer: p.makeRenderer });
  p.flush();
  await pending;
  assert.equal(p.attrs["data-u3d-view"], "network");
  // Scrolling moves the same elements up by 700 px.
  for (const el of p.doc.sections) el.rect = { top: el.rect.top - 700, bottom: el.rect.bottom - 700 };
  p.winL.fire("scroll");
  p.flush();
  assert.equal(p.attrs["data-u3d-view"], "dial");
});

test("many scroll events in one frame read the layout once; sections are queried once", async () => {
  const p = fakePage();
  let reads = 0, queries = 0;
  const s = { getAttribute: () => "network", hasAttribute: () => false, getBoundingClientRect: () => (reads++, { top: 0, bottom: 900 }) };
  p.doc.sections = [s];
  const q = p.doc.querySelectorAll.bind(p.doc);
  p.doc.querySelectorAll = (sel) => (queries++, q(sel));
  const pending = start(p.canvas, data, { mode: "test", makeRenderer: p.makeRenderer });
  p.flush();
  await pending;
  reads = 0;
  p.winL.fire("scroll");
  p.winL.fire("scroll");
  p.winL.fire("scroll");
  p.flush();
  assert.equal(reads, 1);
  assert.equal(queries, 1);
});

test("if clean-up throws on a lost context, onLost still runs", async () => {
  const p = fakePage();
  let lost = 0;
  const pending = start(p.canvas, data, { mode: "test", makeRenderer: p.makeRenderer, onLost: () => lost++ });
  p.flush();
  await pending;
  p.renderer.dispose = () => { throw new Error("context gone"); };
  assert.throws(() => p.canvasL.fire("webglcontextlost"));
  assert.equal(lost, 1);
});
