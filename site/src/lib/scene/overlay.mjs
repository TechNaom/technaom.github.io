// Stage labels (R12, R13): copies of a stage's HTML list, placed next to their 3D anchors on drawn frames.
// The overlay is aria-hidden; the list stays in the page for screen readers and the copy gate.
// Layout reads (stage-card rects) happen in readCards(), called on scroll and resize, never per frame.
import { Vector3 } from "three";
import { toScreen, declutter } from "./labels.mjs";

/**
 * createOverlay({ doc, win, el, anchorPoint }) → { update(key, stageEl, phone), readCards(), place(camera, world),
 * invalidate(), clear() }. `anchorPoint(anchor)` returns [x, y, z] in world space, or null.
 */
export function createOverlay({ doc, win, el, anchorPoint }) {
  let items = [];
  let cards = [];
  let cardRects = [];
  let key = null;
  const v3 = new Vector3();

  const build = (stageEl, phone) => {
    el.replaceChildren();
    items = [];
    cards = [];
    cardRects = [];
    if (!stageEl) return;
    cards = [...stageEl.querySelectorAll("[data-scene-card]")];
    for (const li of stageEl.querySelectorAll("ol.u3d-labels li[data-anchor]")) {
      const anchor = li.getAttribute("data-anchor");
      if (phone && anchor.startsWith("hour:")) continue; // phones: no hour labels (architecture point 14)
      const label = doc.createElement("div");
      label.className = "u3d-label";
      label.setAttribute("data-anchor", anchor);
      const name = doc.createElement("span");
      name.className = "lb-name";
      name.textContent = li.querySelector(".lb-name")?.textContent ?? "";
      label.append(name);
      const detail = li.querySelector(".lb-detail")?.textContent;
      if (detail && !phone) {
        const d = doc.createElement("span");
        d.className = "lb-detail";
        d.textContent = detail;
        label.append(d);
      }
      el.append(label);
      items.push({ el: label, anchor, w: label.offsetWidth, h: label.offsetHeight });
    }
  };

  return {
    /** Rebuild when the labelled stage or the phone layout changes (key), else keep the labels. */
    update(nextKey, stageEl, phone) {
      if (nextKey === key) return;
      key = nextKey;
      build(stageEl, phone);
    },
    /** Read the stage cards' rects: call on scroll and resize only. */
    readCards() {
      cardRects = cards.map((c) => c.getBoundingClientRect());
    },
    /** Place every label next to its anchor: inside the screen, not overlapping, never behind a card. */
    place(camera, world) {
      if (!items.length) return;
      const w = win.innerWidth, h = win.innerHeight;
      const behindCard = (b) => cardRects.some((r) => b.x < r.right && r.left < b.x + b.w && b.y < r.bottom && r.top < b.y + b.h);
      world.updateMatrixWorld();
      camera.updateMatrixWorld();
      const boxes = items.map((it) => {
        const p = anchorPoint(it.anchor);
        if (!p) return { x: 0, y: 0, w: it.w, h: it.h, hidden: true };
        v3.set(p[0], p[1], p[2]).applyMatrix4(world.matrixWorld).project(camera);
        const sc = toScreen(v3, w, h);
        const box = { x: sc.x + 10, y: sc.y - it.h / 2, w: it.w, h: it.h };
        return { ...box, hidden: !sc.visible || behindCard(box) }; // a hidden label takes no space
      });
      declutter(boxes, { step: 14, centre: { x: w / 2, y: h / 2 } }).forEach((b, i) => {
        const inside = b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h;
        const st = items[i].el.style;
        st.visibility = b.hidden || !inside || behindCard(b) ? "hidden" : "visible";
        st.transform = `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px)`;
      });
    },
    /** Forget the current labels so the next update rebuilds them (after the web font loads). */
    invalidate() {
      key = null;
    },
    clear() {
      el.replaceChildren();
      items = [];
    },
  };
}
