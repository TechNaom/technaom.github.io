// The start() contract with boot (T5 review, T6 code check): "on" only after a first frame on a live canvas,
// full clean-up when anything fails or boot gives up, and no redraw loop for a still scene.
import { test } from "node:test";
import assert from "node:assert/strict";
import teams from "../../src/data/teams.json" with { type: "json" };
import journey from "../../src/data/journey.json" with { type: "json" };
import { buildSceneData } from "../../src/lib/scene/data.mjs";
import { start } from "../../src/lib/scene/scene.mjs";
import { viewFor } from "../../src/lib/scene/views.mjs";

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

function fakePage({ renderThrows = false, reduced = false } = {}) {
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
    matchMedia: (q) => ({ matches: reduced && q.includes("reduce") }),
    addEventListener: winL.addEventListener, removeEventListener: winL.removeEventListener,
  };
  const fakeEl = () => ({ style: {}, offsetWidth: 60, offsetHeight: 20, className: "", children: [], setAttribute() {}, append(c) { this.children.push(c); }, replaceChildren() { this.children = []; }, remove() {} });
  const doc = {
    hidden: false, defaultView: win, sections: [], overlay: null,
    getElementById(id) { return id === "u3d-overlay" ? this.overlay : null; },
    createElement: () => fakeEl(),
    body: fakeEl(),
    querySelectorAll(sel) { return sel === "[data-scene]" ? this.sections : []; },
    documentElement: {
      setAttribute: (k, v) => (attrs[k] = v),
      removeAttribute: (k) => delete attrs[k],
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
  let clock = 0;
  /** Run the queued frames once, `dt` ms after the last call (a clock that moves). */
  const flushAt = (dt = 16) => { clock += dt; const due = [...frames]; frames.clear(); due.forEach(([, fn]) => fn(clock)); };
  return { win, doc, canvas, canvasL, renderer, attrs, classes, frames, flush, flushAt, winL, docL, fakeEl, makeRenderer: () => renderer };
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

test("a quiet drift section dims the materials to 0.7 x 0.4; the network view is full strength", async () => {
  const p = fakePage();
  p.win.__u3d = {}; // the probe boot sets in test mode
  const quietDrift = { rect: { top: 0, bottom: 900 }, getAttribute: (k) => (k === "data-scene" ? "drift" : null), hasAttribute: (k) => k === "data-scene-quiet", getBoundingClientRect() { return { ...this.rect }; } };
  p.doc.sections = [quietDrift];
  const pending = start(p.canvas, data, { mode: "test", makeRenderer: p.makeRenderer });
  p.flush();
  await pending;
  assert.ok(Math.abs(p.win.__u3d.opacity - 0.28) < 1e-9);
  assert.equal(p.attrs["data-u3d-quiet"], "");
  quietDrift.rect = { top: 900, bottom: 1800 }; // scrolled away: nothing in the middle, so the default drift, not quiet
  p.winL.fire("scroll");
  p.flush();
  assert.ok(Math.abs(p.win.__u3d.opacity - 0.7) < 1e-9);
  assert.equal("data-u3d-quiet" in p.attrs, false);
});

test("the network view is at full strength", async () => {
  const p = fakePage();
  p.win.__u3d = {};
  p.doc.sections = [{ getAttribute: (k) => (k === "data-scene" ? "network" : null), hasAttribute: () => false, getBoundingClientRect: () => ({ top: 0, bottom: 900 }) }];
  const pending = start(p.canvas, data, { mode: "test", makeRenderer: p.makeRenderer });
  p.flush();
  await pending;
  assert.equal(p.win.__u3d.opacity, 1);
  assert.equal("data-u3d-quiet" in p.attrs, false);
});

test("reduced motion: no idle loop, no pulses, even in normal mode", async () => {
  const p = fakePage({ reduced: true });
  p.win.__u3d = {};
  const pending = start(p.canvas, data, { mode: "normal", makeRenderer: p.makeRenderer });
  p.flush();
  const { stop } = await pending;
  for (let i = 0; i < 3; i++) p.flush();
  assert.equal(p.frames.size, 0, "no loop queued");
  assert.equal(p.win.__u3d.pulses, 0);
  stop();
});

test("normal mode launches pulses along the links as frames run", async () => {
  const p = fakePage();
  p.win.__u3d = {};
  let t = 0;
  const flushAt = () => { const due = [...p.frames]; p.frames.clear(); t += 400; due.forEach(([, fn]) => fn(t)); };
  const pending = start(p.canvas, data, { mode: "normal", makeRenderer: p.makeRenderer });
  flushAt();
  const { stop } = await pending;
  for (let i = 0; i < 20; i++) flushAt();
  assert.ok(p.win.__u3d.pulses > 0, `pulses launched: ${p.win.__u3d.pulses}`);
  stop();
});

test("stop() removes the view and quiet markers it put on <html>", async () => {
  const p = fakePage();
  const quietDrift = { getAttribute: (k) => (k === "data-scene" ? "drift" : null), hasAttribute: (k) => k === "data-scene-quiet", getBoundingClientRect: () => ({ top: 0, bottom: 900 }) };
  p.doc.sections = [quietDrift];
  const pending = start(p.canvas, data, { mode: "test", makeRenderer: p.makeRenderer });
  p.flush();
  const { stop } = await pending;
  assert.equal(p.attrs["data-u3d-view"], "drift");
  assert.equal(p.attrs["data-u3d-quiet"], "");
  stop();
  assert.equal("data-u3d-view" in p.attrs, false);
  assert.equal("data-u3d-quiet" in p.attrs, false);
});

// --- T15a: frame budget ---------------------------------------------------------------------------------

const sectionOf = (view, top, bottom, { labels = false, quiet = false, inner = {} } = {}) => ({
  rect: { top, bottom },
  getAttribute: (k) => (k === "data-scene" ? view : null),
  hasAttribute: (k) => (k === "data-scene-labels" ? labels : k === "data-scene-quiet" ? quiet : false),
  getBoundingClientRect() { return { ...this.rect }; },
  querySelectorAll: (sel) => inner[sel] ?? [],
});

test("idle motion is capped at 30 frames a second: 10 ms frames draw at most every fourth time", async () => {
  const p = fakePage();
  p.win.__u3d = {};
  const pending = start(p.canvas, data, { mode: "normal", makeRenderer: p.makeRenderer });
  p.flushAt(10);
  const { stop } = await pending;
  const before = p.renderer.renders;
  for (let i = 0; i < 12; i++) p.flushAt(10);
  assert.ok(p.renderer.renders - before <= 4, `drew ${p.renderer.renders - before} of 12 frames`);
  assert.ok(p.renderer.renders - before >= 3, "still animating");
  stop();
});

test("a quiet section pauses idle motion: no loop, no pulses", async () => {
  const p = fakePage();
  p.win.__u3d = {};
  p.doc.sections = [sectionOf("drift", 0, 900, { quiet: true })];
  const pending = start(p.canvas, data, { mode: "normal", makeRenderer: p.makeRenderer });
  p.flushAt(40);
  const { stop } = await pending;
  for (let i = 0; i < 10; i++) p.flushAt(40);
  assert.equal(p.frames.size, 0, "no loop while quiet");
  assert.equal(p.win.__u3d.pulses, 0);
  stop();
});

test("a view change in the middle of a move ends at the new view's pose", async () => {
  const p = fakePage();
  p.win.__u3d = {};
  const net = sectionOf("network", 0, 600), dial = sectionOf("dial", 600, 1200), jour = sectionOf("journey", 1200, 1800);
  p.doc.sections = [net, dial, jour];
  const pending = start(p.canvas, data, { mode: "normal", makeRenderer: p.makeRenderer });
  p.flushAt(40);
  const { stop } = await pending;
  const scrollTo = (y) => { for (const [el, top] of [[net, 0], [dial, 600], [jour, 1200]]) el.rect = { top: top - y, bottom: top + 600 - y }; p.winL.fire("scroll"); };
  scrollTo(600); // dial in the middle: a move starts
  p.flushAt(40);
  p.flushAt(200); // part way
  scrollTo(1200); // journey in the middle, before the dial move ends
  for (let i = 0; i < 30; i++) p.flushAt(100);
  const v = viewFor("journey", { phone: p.win.innerWidth < 900 });
  const want = [v.camera[0] - v.offset, v.camera[1], v.camera[2]];
  assert.equal(p.win.__u3d.view, "journey");
  assert.equal(p.win.__u3d.moving, false);
  p.win.__u3d.camera.forEach((c, i) => assert.ok(Math.abs(c - want[i]) < 1e-6, `camera[${i}] ${c} vs ${want[i]}`));
  stop();
});

test("stage-card positions are read on scroll, not on every idle frame", async () => {
  const p = fakePage();
  p.win.__u3d = {};
  p.doc.overlay = p.fakeEl();
  let reads = 0;
  const card = { getBoundingClientRect: () => (reads++, { top: 0, bottom: 100, left: 0, right: 100 }) };
  const li = { getAttribute: () => "team:nobody", querySelector: () => ({ textContent: "A label" }) };
  p.doc.sections = [sectionOf("dial", 0, 900, { labels: true, inner: { "[data-scene-card]": [card], "ol.u3d-labels li[data-anchor]": [li] } })];
  const pending = start(p.canvas, data, { mode: "normal", makeRenderer: p.makeRenderer });
  p.flushAt(40);
  const { stop } = await pending;
  reads = 0;
  for (let i = 0; i < 8; i++) p.flushAt(40); // idle frames, no scroll
  assert.equal(reads, 0, "no card reads on idle frames");
  p.winL.fire("scroll");
  p.winL.fire("scroll");
  p.winL.fire("scroll");
  p.flushAt(40);
  assert.equal(reads, 1, "one read for a burst of scroll events");
  stop();
});
