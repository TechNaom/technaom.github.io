// Placing a stage's labels on screen (R12, R13), as plain functions: the scene projects each anchor,
// then these turn clip-space points into screen boxes that never overlap and never leave the screen.

/** Clip space (x, y in -1..1, z <= 1 in front of the camera) to screen pixels, top-left origin. */
export function toScreen(ndc, width, height) {
  const x = ((ndc.x + 1) / 2) * width;
  const y = ((1 - ndc.y) / 2) * height;
  const visible = ndc.z >= -1 && ndc.z <= 1 && x >= 0 && x <= width && y >= 0 && y <= height;
  return { x, y, visible };
}

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Every pair of boxes that touch, as [i, j] with i < j. */
export function overlaps(boxes) {
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i], boxes[j])) out.push([i, j]);
  return out;
}

/**
 * declutter(boxes, { step, centre }) → boxes with `hidden`. In order: a box that overlaps one already placed
 * moves away from the centre by `step` pixels, at most 6 times; one still overlapping is hidden.
 * Boxes already marked hidden stay hidden and take no space.
 */
export function declutter(boxes, { step = 12, centre = { x: 0, y: 0 } } = {}) {
  const placed = [];
  return boxes.map((b) => {
    if (b.hidden) return { ...b };
    const box = { ...b, hidden: false };
    const dx = box.x + box.w / 2 - centre.x, dy = box.y + box.h / 2 - centre.y;
    const len = Math.hypot(dx, dy) || 1;
    let moves = 0;
    while (placed.some((p) => hit(p, box)) && moves < 6) {
      box.x += (dx / len) * step;
      box.y += (dy / len) * step;
      moves++;
    }
    if (placed.some((p) => hit(p, box))) box.hidden = true;
    else placed.push(box);
    return box;
  });
}
