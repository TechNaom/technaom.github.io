// R12: where each team sits in the dial view (architecture point 7), as plain data.
import { test } from "node:test";
import assert from "node:assert/strict";
import teams from "../../src/data/teams.json" with { type: "json" };
import journey from "../../src/data/journey.json" with { type: "json" };
import { buildSceneData } from "../../src/lib/scene/data.mjs";
import { mulberry32 } from "../../src/lib/scene/rng.mjs";
import { buildNetwork } from "../../src/lib/scene/network.mjs";
import { dialPlace, hourPoint, layout, INNER_RING, OUTER_RING } from "../../src/lib/scene/layout.mjs";

const data = buildSceneData(teams, journey);
const net = buildNetwork(data, mulberry32(2026));
const TAU = Math.PI * 2;
const close = (a, b) => Math.abs(a - b) < 1e-9;

test("teams with a daily time sit on the inner ring at hour / 24 of a turn, midnight at the top", () => {
  const place = dialPlace([{ id: "a", hour: 6 }, { id: "b", hour: 0 }, { id: "c", hour: 23.5 }]);
  assert.ok(close(place.get("a").angle, Math.PI / 2));
  assert.ok(close(place.get("b").angle, 0));
  assert.ok(close(place.get("c").angle, (23.5 / 24) * TAU));
  for (const p of place.values()) assert.equal(p.ring, "inner");
});

test("teams without a daily time sit on the outer ring, in order, inside the 6 PM to 4 AM arc", () => {
  const place = dialPlace(data.teams);
  const outer = data.teams.filter((t) => t.hour === null).map((t) => place.get(t.id));
  assert.ok(outer.length > 0);
  const from = (18 / 24) * TAU, to = (28 / 24) * TAU;
  let last = -Infinity;
  for (const p of outer) {
    assert.equal(p.ring, "outer");
    const a = p.angle < from ? p.angle + TAU : p.angle; // unwrap past midnight
    assert.ok(a > from && a < to, `angle ${a} inside the arc`);
    assert.ok(a > last, "in teams.json order");
    last = a;
  }
});

test("hour points: midnight at the top (-z), 6 AM to the right (+x), on the inner ring", () => {
  const [x0, y0, z0] = hourPoint(0);
  assert.ok(close(x0, 0) && close(y0, 0) && close(z0, -INNER_RING));
  const [x6, , z6] = hourPoint(6);
  assert.ok(close(x6, INNER_RING) && close(z6, 0));
  assert.ok(OUTER_RING > INNER_RING);
});

test("dial layout: hubs on their ring point, agents keep their distance to their hub, field unchanged", () => {
  const pos = layout(net, "dial", data);
  assert.equal(pos.length, net.nodes.length * 3);
  const at = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const place = dialPlace(data.teams);
  net.nodes.forEach((n, i) => {
    if (n.kind === "hub") {
      const { angle, ring } = place.get(n.team);
      const r = ring === "inner" ? INNER_RING : OUTER_RING;
      assert.ok(dist(at(i), [Math.sin(angle) * r, 0, -Math.cos(angle) * r]) < 1e-5, `hub ${n.team}`);
    }
    if (n.kind === "agent") {
      const h = net.nodes.findIndex((m) => m.kind === "hub" && m.team === n.team);
      assert.ok(Math.abs(dist(at(i), at(h)) - dist(n.pos, net.nodes[h].pos)) < 1e-4, `agent ${i}`);
    }
    if (n.kind === "field" || n.kind === "core") assert.ok(dist(at(i), n.pos) < 1e-5);
  });
});

test("network, drift and journey layouts are the T6 positions", () => {
  for (const view of ["network", "drift", "journey"]) {
    const pos = layout(net, view, data);
    net.nodes.forEach((n, i) => assert.ok(Math.hypot(pos[i * 3] - n.pos[0], pos[i * 3 + 1] - n.pos[1], pos[i * 3 + 2] - n.pos[2]) < 1e-5));
  }
});
