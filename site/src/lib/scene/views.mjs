// The reusable 3D views (the templates). A section picks one with data-scene="<name>".
// Plain JavaScript with no three.js import, so node:test can load it. See ADR 0003.

const view = (v) => Object.freeze({ offset: 0, dial: 0, journey: 0, opacity: 1, ...v });

/** Camera and network settings per view; T8 tunes the numbers. */
export const VIEWS = Object.freeze({
  network: view({ camera: [0, 3, 22], target: [0, 0, 0], offset: 4 }),
  dial: view({ camera: [0, 12, 10], target: [0, 0, 0], dial: 1 }),
  journey: view({ camera: [0, 2, 12], target: [0, 0, 0], journey: 1 }),
  drift: view({ camera: [0, -2, 24], target: [0, 0, 0], offset: 2, opacity: 0.7 }),
});

/** A known view name, or "drift". */
export const resolveView = (name) => (Object.hasOwn(VIEWS, name) ? name : "drift");

/** Phones (under 900px wide) have no side offset and stand this much further back. */
export const PHONE_DISTANCE = 1.6;
/** ...and look this much higher (world units), so the network sits below the hero text, not on it. */
export const PHONE_LIFT = 5;

/**
 * The view's settings for this screen. `offset` shifts the network right along x (world units),
 * clear of left-aligned text; a phone has none and moves the camera back along its line of sight.
 */
export function viewFor(name, { phone = false } = {}) {
  const v = VIEWS[resolveView(name)];
  if (!phone) return { ...v };
  const camera = v.camera.map((c, i) => v.target[i] + (c - v.target[i]) * PHONE_DISTANCE + (i === 1 ? PHONE_LIFT : 0));
  const target = v.target.map((t, i) => t + (i === 1 ? PHONE_LIFT : 0));
  return { ...v, camera, target, offset: 0 };
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const NONE = Object.freeze({ view: "drift", labels: false, quiet: false, progress: 0 });

/**
 * The section that contains the middle line of the screen wins (top <= mid < bottom); when
 * several do, the shortest (innermost) wins, and a tie goes to the later one.
 * @param {{top:number,bottom:number,view?:string,labels?:boolean,quiet?:boolean}[]} sections screen pixels
 * @param {number} viewportHeight
 * @returns {{view:string,labels:boolean,quiet:boolean,progress:number}}
 */
export function pickView(sections, viewportHeight) {
  const mid = viewportHeight / 2;
  let best = null;
  for (const s of sections) {
    if (!(s.top <= mid && mid < s.bottom)) continue;
    if (!best || s.bottom - s.top <= best.bottom - best.top) best = s;
  }
  if (!best) return { ...NONE };
  const height = best.bottom - best.top;
  return {
    view: resolveView(best.view),
    labels: Boolean(best.labels),
    quiet: Boolean(best.quiet),
    progress: clamp((0.75 * viewportHeight - best.top) / (0.8 * height), 0, 1),
  };
}
