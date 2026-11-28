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
