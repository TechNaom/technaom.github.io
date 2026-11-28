// The shape of the neural network, as plain data: no three.js here, so it is unit-tested in Node.
// One core, one hub per team on a ring around it, each team's agents around its hub, and a field of
// background nodes in a loose shell further out.

export const FIELD_NODES = 120;
/** At most this many agents per team, whatever the data says. */
export const MAX_CREW = 64;

const HUB_RING = 6;
const AGENT_RADIUS = 1.6;
const FIELD_INNER = 11;
const FIELD_OUTER = 18;

const round = (v) => Math.round(v * 1000) / 1000;
const vec = (x, y, z) => [round(x), round(y), round(z)];

/** A point at a random direction and a radius between r0 and r1, from three numbers in [0, 1). */
function inShell(rand, r0, r1) {
  const u = rand() * 2 - 1;
  const phi = rand() * Math.PI * 2;
  const r = r0 + (r1 - r0) * rand();
  const s = Math.sqrt(1 - u * u);
  return [r * s * Math.cos(phi), r * u, r * s * Math.sin(phi)];
}

/**
 * buildNetwork(data, rand) → { nodes: [{ kind, team, pos }], links: [[i, j]] }.
 * `data` is the scene data (data.mjs); `rand` a seeded generator (rng.mjs). Pure: same inputs, same output.
 */
export function buildNetwork(data, rand) {
  const nodes = [{ kind: "core", team: null, pos: vec(0, 0, 0) }];
  const links = [];
  const teams = data.teams || [];

  teams.forEach((team, t) => {
    const angle = (t / Math.max(teams.length, 1)) * Math.PI * 2;
    const tilt = (rand() - 0.5) * 2.4;
    const hub = [Math.cos(angle) * HUB_RING, tilt, Math.sin(angle) * HUB_RING];
    const hubIndex = nodes.push({ kind: "hub", team: team.id, pos: vec(...hub) }) - 1;
    links.push([0, hubIndex]);
    const crew = Math.min(Math.max(Math.trunc(Number(team.crew)) || 0, 0), MAX_CREW);
    for (let a = 0; a < crew; a++) {
      const [x, y, z] = inShell(rand, AGENT_RADIUS * 0.6, AGENT_RADIUS);
      const i = nodes.push({ kind: "agent", team: team.id, pos: vec(hub[0] + x, hub[1] + y, hub[2] + z) }) - 1;
      links.push([hubIndex, i]);
    }
  });

  const first = nodes.length;
  for (let f = 0; f < FIELD_NODES; f++) nodes.push({ kind: "field", team: null, pos: vec(...inShell(rand, FIELD_INNER, FIELD_OUTER)) });

  const seen = new Set();
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  for (let i = first; i < nodes.length; i++) {
    const near = [];
    for (let j = first; j < nodes.length; j++) if (j !== i) near.push([d2(nodes[i].pos, nodes[j].pos), j]);
    near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [, j] of near.slice(0, 2)) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        links.push(i < j ? [i, j] : [j, i]);
      }
    }
  }
  return { nodes, links };
}
