import { test } from "node:test";
import assert from "node:assert/strict";
import teams from "../../src/data/teams.json" with { type: "json" };
import journey from "../../src/data/journey.json" with { type: "json" };
import { buildSceneData } from "../../src/lib/scene/data.mjs";
import { mulberry32 } from "../../src/lib/scene/rng.mjs";
import { buildNetwork, FIELD_NODES, MAX_CREW } from "../../src/lib/scene/network.mjs";

const data = buildSceneData(teams, journey);
const crewSum = data.teams.reduce((n, t) => n + t.crew, 0);
const build = () => buildNetwork(data, mulberry32(2026));

test("the scene data carries seed 2026", () => assert.equal(data.seed, 2026));

test("mulberry32: same seed, same numbers, all in [0, 1)", () => {
  const a = mulberry32(2026), b = mulberry32(2026), c = mulberry32(7);
  const xs = Array.from({ length: 50 }, a);
  assert.deepEqual(xs, Array.from({ length: 50 }, b));
  assert.notDeepEqual(xs, Array.from({ length: 50 }, c));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test("node counts by kind: 1 core, a hub per team, crew agents, FIELD_NODES field", () => {
  const { nodes } = build();
  const count = (k) => nodes.filter((n) => n.kind === k).length;
  assert.equal(FIELD_NODES, 120);
  assert.equal(count("core"), 1);
  assert.equal(count("hub"), data.teams.length);
  assert.equal(count("agent"), crewSum);
  assert.equal(count("field"), FIELD_NODES);
  assert.equal(nodes.length, 1 + data.teams.length + crewSum + FIELD_NODES);
});

test("links: every agent to its team's hub, every hub to the core, field to 2 nearest field nodes", () => {
  const { nodes, links } = build();
  const linked = (i, j) => links.some(([a, b]) => (a === i && b === j) || (a === j && b === i));
  const core = nodes.findIndex((n) => n.kind === "core");
  nodes.forEach((n, i) => {
    if (n.kind === "agent") {
      const hub = nodes.findIndex((h) => h.kind === "hub" && h.team === n.team);
      assert.ok(hub >= 0 && linked(i, hub), `agent ${i} of ${n.team} links to its hub`);
    }
    if (n.kind === "hub") assert.ok(linked(i, core), `hub ${n.team} links to the core`);
  });
  const field = nodes.map((n, i) => [n, i]).filter(([n]) => n.kind === "field");
  const d2 = (p, q) => p.reduce((s, v, k) => s + (v - q[k]) ** 2, 0);
  for (const [n, i] of field) {
    const nearest = field.filter(([, j]) => j !== i).sort((a, b) => d2(n.pos, a[0].pos) - d2(n.pos, b[0].pos)).slice(0, 2);
    for (const [, j] of nearest) assert.ok(linked(i, j), `field ${i} links to near neighbour ${j}`);
  }
  for (const [a, b] of links) assert.ok(a !== b && nodes[a] && nodes[b], "links point at real, distinct nodes");
  const keys = links.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`);
  assert.equal(new Set(keys).size, keys.length, "no duplicate links");
});

test("same seed gives the same network; positions are finite numbers", () => {
  const a = build(), b = build();
  assert.deepEqual(a, b);
  assert.ok(a.nodes.every((n) => n.pos.length === 3 && n.pos.every(Number.isFinite)));
  assert.ok(a.nodes.filter((n) => n.kind !== "core").every((n) => typeof n.team === "string" || n.kind === "field"));
});

test("no teams: just the core and the field; bad crew counts are clamped", () => {
  const empty = buildNetwork({ teams: [] }, mulberry32(2026));
  assert.equal(empty.nodes.length, 1 + FIELD_NODES);
  const odd = buildNetwork({ teams: [{ id: "a", crew: -3 }, { id: "b", crew: "x" }, { id: "c", crew: 1e6 }] }, mulberry32(2026));
  const agents = (t) => odd.nodes.filter((n) => n.kind === "agent" && n.team === t).length;
  assert.equal(agents("a"), 0);
  assert.equal(agents("b"), 0);
  assert.equal(agents("c"), MAX_CREW);
});

test("agents sit near their hub; field nodes sit in the outer shell", () => {
  const { nodes } = build();
  const dist = (p, q = [0, 0, 0]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  for (const n of nodes) {
    if (n.kind === "agent") assert.ok(dist(n.pos, nodes.find((h) => h.kind === "hub" && h.team === n.team).pos) <= 1.61);
    if (n.kind === "field") assert.ok(dist(n.pos) >= 10.99 && dist(n.pos) <= 18.01);
  }
});
