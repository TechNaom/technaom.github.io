import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldStart, modeFrom } from "../../src/lib/scene/boot.mjs";

test("WebGL and no data saver: start", () => {
  assert.equal(shouldStart({ webgl: true, saveData: false }), "start");
});

test("no WebGL: fallback (the visitor could not run it)", () => {
  assert.equal(shouldStart({ webgl: false, saveData: false }), "fallback");
});

test("data saver: off (the visitor chose less data)", () => {
  assert.equal(shouldStart({ webgl: true, saveData: true }), "off");
});

test("both: off wins, since it is the visitor's choice", () => {
  assert.equal(shouldStart({ webgl: false, saveData: true }), "off");
});

test("mode from the URL: test, debug, or normal", () => {
  assert.equal(modeFrom("?u3d=test"), "test");
  assert.equal(modeFrom("?a=1&u3d=debug"), "debug");
  assert.equal(modeFrom("?u3d=nonsense"), "normal");
  assert.equal(modeFrom(""), "normal");
});

// boot() with a fake page: every way it can go wrong must end in a settled state, never "idle"/"loading".
import { boot } from "../../src/lib/scene/boot.mjs";

function fakePage({ navigatorThrows = false } = {}) {
  const attrs = {};
  const classes = new Set();
  let canvas = { removed: false, remove() { this.removed = true; } };
  const doc = {
    readyState: "complete",
    documentElement: {
      setAttribute: (k, v) => (attrs[k] = v),
      classList: { remove: (c) => classes.delete(c), add: (c) => classes.add(c) },
    },
    getElementById: (id) => (id === "u3d-canvas" ? canvas : id === "u3d-data" ? { textContent: '{"version":1}' } : null),
    createElement: () => ({ getContext: () => ({ getExtension: () => null }) }),
  };
  const win = {
    location: { search: "" },
    WebGL2RenderingContext: function () {},
    requestIdleCallback: (fn) => fn(),
    setTimeout: (fn) => fn(),
    addEventListener: () => {},
  };
  Object.defineProperty(win, "navigator", { get() { if (navigatorThrows) throw new Error("boom"); return {}; } });
  return { doc, win, attrs, classes, canvas: () => canvas };
}

test("an unexpected error anywhere in boot ends in fallback, not idle", async () => {
  const p = fakePage({ navigatorThrows: true });
  await boot(p.doc, p.win);
  assert.equal(p.attrs["data-u3d-state"], "fallback");
  assert.equal(p.canvas().removed, true);
});

test("a scene chunk that never answers ends in fallback after the time limit", async () => {
  const p = fakePage();
  const never = () => new Promise(() => {});
  await boot(p.doc, p.win, { load: never, limitMs: 50 });
  assert.equal(p.attrs["data-u3d-state"], "fallback");
});

test("a scene that starts keeps its own state; boot does not overwrite it", async () => {
  const p = fakePage();
  const load = async () => ({ start: async () => p.doc.documentElement.setAttribute("data-u3d-state", "on") });
  await boot(p.doc, p.win, { load, limitMs: 1000 });
  assert.equal(p.attrs["data-u3d-state"], "on");
  assert.equal(p.canvas().removed, false);
});

test("when boot gives up on a slow start, it aborts the signal so the scene stops itself", async () => {
  const p = fakePage();
  let signal;
  const load = async () => ({ start: (_c, _d, opts) => ((signal = opts.signal), new Promise(() => {})) });
  await boot(p.doc, p.win, { load, limitMs: 50 });
  assert.equal(p.attrs["data-u3d-state"], "fallback");
  assert.ok(signal, "start received a signal");
  assert.equal(signal.aborted, true);
});
