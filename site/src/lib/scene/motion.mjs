// Camera easing and the node morph between views (T15a): plain JavaScript, no allocation per frame.

/** Ease in and out (quadratic): 0 → 0, 0.5 → 0.5, 1 → 1. */
export const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** out[i] = a[i] + (b[i] - a[i]) * k, written into `out` (returned). */
export function lerpInto(out, a, b, k) {
  for (let i = 0; i < out.length; i++) out[i] = a[i] + (b[i] - a[i]) * k;
  return out;
}

/**
 * A morph between two position arrays with two scratch buffers: `begin` copies the start (so a move that starts
 * from the previous move's output never reads the buffer it writes), `at(k)` writes into one reused output.
 */
export function createMorph(length) {
  const from = new Float32Array(length);
  const out = new Float32Array(length);
  let to = out;
  return {
    begin(start, end) {
      from.set(start);
      to = end;
    },
    at(k) {
      return lerpInto(out, from, to, k);
    },
  };
}
