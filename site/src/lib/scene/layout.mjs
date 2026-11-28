// Node positions per view, as plain data (no three.js): the scene morphs between these arrays.
// The dial puts each team on a 24-hour clock (architecture point 7), seen from above.

export const INNER_RING = 6;
export const OUTER_RING = 8.5;

const TAU = Math.PI * 2;
const ARC_FROM = 18; // 6 PM
const ARC_HOURS = 10; // to 4 AM

/** A point on a ring of the dial for an angle (0 = midnight at the top, clockwise seen from above). */
const ringPoint = (angle, r) => [Math.sin(angle) * r, 0, -Math.cos(angle) * r];

/** The inner-ring point for an hour of the day (0 to 24). */
export const hourPoint = (hour) => ringPoint((hour / 24) * TAU, INNER_RING);

/**
 * dialPlace(teams) → Map<id, { angle, ring }>. Teams with a daily time are on the inner ring at their hour;
 * teams without one are on the outer ring, evenly spaced over 6 PM to 4 AM in the given order. That place
 * means "not on a daily clock", never a time.
 */
export function dialPlace(teams) {
  const place = new Map();
  const loose = teams.filter((t) => t.hour === null || t.hour === undefined);
  for (const t of teams) if (!loose.includes(t)) place.set(t.id, { angle: (t.hour / 24) * TAU, ring: "inner" });
  loose.forEach((t, i) => {
    const hour = ARC_FROM + ((i + 0.5) / loose.length) * ARC_HOURS;
    place.set(t.id, { angle: ((hour % 24) / 24) * TAU, ring: "outer" });
  });
  return place;
}

/**
 * layout(network, view, data) → Float32Array, 3 numbers per node in network.nodes order.
 * "dial": hubs on their ring point (y 0), each agent at its hub's point plus its original offset from the hub,
 * core and field nodes unchanged. Every other view keeps the network's own positions.
 */
export function layout(network, view, data) {
  const { nodes } = network;
  const out = new Float32Array(nodes.length * 3);
  nodes.forEach((n, i) => out.set(n.pos, i * 3));
  if (view !== "dial") return out;

  const place = dialPlace(data.teams || []);
  const hubOf = new Map();
  nodes.forEach((n, i) => {
    if (n.kind !== "hub" || !place.has(n.team)) return;
    const { angle, ring } = place.get(n.team);
    const p = ringPoint(angle, ring === "inner" ? INNER_RING : OUTER_RING);
    hubOf.set(n.team, { from: n.pos, to: p });
    out.set(p, i * 3);
  });
  nodes.forEach((n, i) => {
    const hub = n.kind === "agent" && hubOf.get(n.team);
    if (!hub) return;
    out.set(n.pos.map((v, k) => hub.to[k] + (v - hub.from[k])), i * 3);
  });
  return out;
}
