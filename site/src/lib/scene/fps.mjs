// A rolling frame-time meter (N4, ADR 0006): the average over the last `windowMs` of drawn frames.
// Plain JavaScript; a fixed ring, so adding a frame allocates nothing.

export function createMeter(windowMs = 2000, capacity = 256) {
  const ring = new Float64Array(capacity);
  let head = 0, count = 0, sum = 0;
  return {
    /** Record one frame's duration in milliseconds. */
    add(dt) {
      if (count === capacity) { sum -= ring[head]; count--; } // full: drop the oldest
      ring[(head + count) % capacity] = dt;
      count++;
      sum += dt;
      while (count > 1 && sum - ring[head] >= windowMs) { // keep only the last windowMs
        sum -= ring[head];
        head = (head + 1) % capacity;
        count--;
      }
    },
    /** Average frame time in ms (0 with no frames). */
    average: () => (count ? sum / count : 0),
    /** Frames a second from the average (0 with no frames). */
    fps: () => (count && sum ? Math.round((1000 * count) / sum) : 0),
    reset() { head = 0; count = 0; sum = 0; },
  };
}
