// One post's journey through the workforce (R12), as plain data: where the steps sit and where the pulse is.

/** The steps on a gentle arc in front of the network: x from -8 to 8, y from -1 (ends) to 1 (middle), z 2. */
export function journeyPoints(steps) {
  const n = steps.length;
  return steps.map((_, i) => {
    const f = n > 1 ? i / (n - 1) : 0.5;
    return [-8 + 16 * f, -1 + 2 * Math.sin(Math.PI * f), 2];
  });
}

/** journeyAt(progress, count) → { step, t }: the step the pulse has reached and the fraction to the next. */
export function journeyAt(progress, count) {
  const last = Math.max(count - 1, 0);
  const x = Math.min(Math.max(progress, 0), 1) * last;
  const step = Math.min(Math.floor(x), last);
  return { step, t: step === last ? 0 : x - step };
}
