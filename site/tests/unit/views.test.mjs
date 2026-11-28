import { test } from "node:test";
import assert from "node:assert/strict";
import { VIEWS, resolveView, pickView, viewFor, PHONE_LIFT } from "../../src/lib/scene/views.mjs";

const VH = 1000; // viewport height; the middle line is at 500
const sec = (top, bottom, view = "network", labels = false, quiet = false) => ({ top, bottom, view, labels, quiet });

test("the registry has exactly the four views", () => {
  assert.deepEqual(Object.keys(VIEWS).sort(), ["dial", "drift", "journey", "network"]);
  assert.ok(Object.isFrozen(VIEWS));
  for (const v of Object.values(VIEWS)) {
    assert.equal(v.camera.length, 3);
    assert.equal(v.target.length, 3);
    assert.equal(typeof v.opacity, "number");
  }
});

test("an unknown or missing name becomes drift", () => {
  assert.equal(resolveView("dial"), "dial");
  assert.equal(resolveView("galaxy"), "drift");
  assert.equal(resolveView(undefined), "drift");
  assert.equal(resolveView("constructor"), "drift"); // not fooled by Object.prototype
});

test("the section containing the middle line wins; others lose", () => {
  const r = pickView([sec(-800, 200, "network"), sec(200, 900, "dial", true), sec(900, 1600, "journey")], VH);
  assert.equal(r.view, "dial");
  assert.equal(r.labels, true);
  assert.equal(r.quiet, false);
});

test("nested sections: the innermost (shortest) wins; a tie goes to the later one", () => {
  const outer = sec(0, 2000, "drift", false, true);
  const inner = sec(400, 700, "journey");
  assert.equal(pickView([outer, inner], VH).view, "journey");
  assert.equal(pickView([inner, outer], VH).view, "journey");
  assert.equal(pickView([sec(0, 1000, "dial"), sec(0, 1000, "network")], VH).view, "network");
});

test("half-open range: bottom === middle does not contain it; zero height never wins", () => {
  assert.equal(pickView([sec(0, 500, "dial")], VH).view, "drift");
  assert.equal(pickView([sec(500, 500, "dial")], VH).view, "drift");
  assert.equal(pickView([sec(500, 501, "dial")], VH).view, "dial");
});

test("no sections or no candidate gives the default", () => {
  assert.deepEqual(pickView([], VH), { view: "drift", labels: false, quiet: false, progress: 0 });
  assert.deepEqual(pickView([sec(600, 900, "dial")], VH), { view: "drift", labels: false, quiet: false, progress: 0 });
});

test("unknown names in a winning section resolve to drift, keeping labels and quiet", () => {
  const r = pickView([sec(0, 1000, "galaxy", true, true)], VH);
  assert.deepEqual([r.view, r.labels, r.quiet], ["drift", true, true]);
});

test("progress: 0 when the top is at 75% of the screen, 1 after moving up 80% of its height, clamped", () => {
  const h = 1700; // a tall journey stage
  const at = (top) => pickView([sec(top, top + h, "journey")], VH).progress;
  assert.equal(at(450), (750 - 450) / (0.8 * h)); // inside the range
  assert.equal(at(750 - 0.8 * h), 1);
  assert.equal(at(750 - 0.9 * h), 1); // past 80%: clamped to 1 (still contains the middle)
  // A short section whose raw progress exceeds 1 is clamped too.
  assert.equal(pickView([sec(-10, 510, "journey")], VH).progress, 1);
});

const dist = (v) => Math.hypot(...v.camera.map((c, i) => c - v.target[i]));

test("viewFor: desktop offsets shift the network clear of the hero text; phones have none and stand back", () => {
  assert.equal(viewFor("network", {}).offset, 4);
  assert.equal(viewFor("drift", {}).offset, 2);
  assert.equal(viewFor("dial", {}).offset, 0);
  assert.equal(viewFor("journey", {}).offset, 5.5); // T10 review: the step arc must clear the stage card on the left
  const desk = viewFor("network", {}), phone = viewFor("network", { phone: true });
  assert.equal(phone.offset, 0);
  assert.ok(Math.abs(dist(phone) / dist(desk) - 1.6) < 1e-9, "phone distance factor (T8: 1.25 left the core on the intro text)");
  assert.deepEqual(viewFor("nope", {}), viewFor("drift", {}));
  // Phones look higher, so the network sits below the hero text (T8 screenshot at 390x844).
  assert.ok(Math.abs(phone.target[1] - desk.target[1] - PHONE_LIFT) < 1e-9);
  assert.ok(Math.abs(phone.camera[1] - (desk.target[1] + (desk.camera[1] - desk.target[1]) * 1.6) - PHONE_LIFT) < 1e-9);
  desk.camera[0] = 99; // a copy: changing it must not change the registry
  assert.notEqual(viewFor("network", {}).camera[0], 99);
  assert.ok(PHONE_LIFT > 0);
});
