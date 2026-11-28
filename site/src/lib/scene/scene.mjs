// The lazy scene chunk (R9, N3): the only file that imports three.js. boot.mjs loads it after the page
// is idle and calls start(). Contract with boot: start() sets data-u3d-state="on" itself after the first
// frame, returns { stop }, and cleans up after itself (loop, listeners, WebGL context) if anything throws.
// Parts: views.mjs (which view), layout.mjs (where nodes sit), motion.mjs (easing and the morph),
// pulses.mjs (signals), overlay.mjs (stage labels), fps.mjs (frame-rate meter).
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Object3D, Group,
  InstancedMesh, IcosahedronGeometry, MeshBasicMaterial,
  BufferGeometry, Float32BufferAttribute, LineSegments, LineBasicMaterial, Line, Mesh,
} from "three";
import { mulberry32 } from "./rng.mjs";
import { buildNetwork } from "./network.mjs";
import { pickView, pickIndex, viewFor } from "./views.mjs";
import { layout, hourPoint } from "./layout.mjs";
import { journeyAt, journeyPoints } from "./journey.mjs";
import { ease, lerpInto, createMorph } from "./motion.mjs";
import { createPulses } from "./pulses.mjs";
import { createOverlay } from "./overlay.mjs";
import { createMeter } from "./fps.mjs";

const MAX_PIXEL_RATIO = 1.5;
const FADE_MS = 600;
const MOVE_MS = 800;
const PHONE_MAX = 900;
const IDLE_MS = 33; // idle motion draws at most 30 frames a second (N4); scroll-driven changes draw at once
const QUIET = 0.4; // a quiet section dims the scene to this share of its view's opacity (R18)
const BACKGROUND = 0x0f1828; // --paper in the dark theme

// Colours come from the site's dark palette (--amber, --cyan, --muted).
const LOOK = {
  core: { color: 0xf4a640, size: 0.55 },
  hub: { color: 0x7fd0ea, size: 0.28 },
  agent: { color: 0xc7e9f5, size: 0.1 },
  field: { color: 0x9aa8be, size: 0.07 },
};

const nextFrame = (win) => new Promise((resolve) => win.requestAnimationFrame(() => resolve()));

/**
 * One InstancedMesh per node kind: four draw calls, whatever the node count.
 * slots[i] = { mesh, k }: where node i lives, so a morph can move it. Positions are written by setPositions.
 */
function nodeMeshes(nodes, disposables) {
  const group = new Group();
  const slots = new Array(nodes.length);
  for (const [kind, look] of Object.entries(LOOK)) {
    const mine = nodes.filter((n) => n.kind === kind);
    if (!mine.length) continue;
    const geometry = new IcosahedronGeometry(look.size, kind === "core" ? 2 : 1);
    const material = new MeshBasicMaterial({ color: look.color, transparent: kind === "field", opacity: kind === "field" ? 0.6 : 1 });
    const mesh = new InstancedMesh(geometry, material, mine.length);
    mesh.frustumCulled = false; // nodes move between views: cached bounding spheres go stale
    disposables.push(geometry, material, mesh);
    nodes.forEach((n, i) => n.kind === kind && (slots[i] = { mesh, k: mine.indexOf(n) }));
    group.add(mesh);
  }
  return { group, slots };
}

/**
 * The journey's steps (R12): small amber nodes on an arc, a line through them and a pulse that travels it.
 * Shown only in a journey section that also has data-scene-labels (the home stage).
 */
function journeyParts(steps, disposables) {
  const group = new Group();
  group.visible = false;
  const points = journeyPoints(steps);
  if (!points.length) return { group, points, pulse: null };
  const dot = new IcosahedronGeometry(0.2, 1);
  const amber = new MeshBasicMaterial({ color: 0xf4a640 });
  const dots = new InstancedMesh(dot, amber, points.length);
  const dummy = new Object3D();
  points.forEach((p, i) => {
    dummy.position.set(p[0], p[1], p[2]);
    dummy.updateMatrix();
    dots.setMatrixAt(i, dummy.matrix);
  });
  const path = new BufferGeometry();
  path.setAttribute("position", new Float32BufferAttribute(points.flat(), 3));
  const pathMat = new LineBasicMaterial({ color: 0xf4a640, transparent: true, opacity: 0.5 });
  const pulseGeo = new IcosahedronGeometry(0.32, 2);
  const pulseMat = new MeshBasicMaterial({ color: 0x7fd0ea });
  const pulse = new Mesh(pulseGeo, pulseMat);
  pulse.position.set(...points[0]);
  disposables.push(dot, amber, dots, path, pathMat, pulseGeo, pulseMat);
  group.add(dots, new Line(path, pathMat), pulse);
  group.traverse((o) => (o.frustumCulled = false));
  return { group, points, pulse };
}

/** Every link in one LineSegments buffer: one draw call. */
function linkLines(links, disposables) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(links.length * 6), 3));
  const material = new LineBasicMaterial({ color: 0x7fd0ea, transparent: true, opacity: 0.22 });
  disposables.push(geometry, material);
  const lines = new LineSegments(geometry, material);
  lines.frustumCulled = false;
  return lines;
}

/**
 * start(canvas, data, { mode, signal, onLost }) → Promise<{ stop() }>.
 * mode "test" keeps the scene still (no idle motion, no easing), so checks and screenshots see one picture;
 * "debug" runs normally and shows the frame rate. Both expose a read-only probe on window.__u3d (set by boot).
 * signal: boot aborts it when it stops waiting; the scene then stops itself and never turns "on".
 * onLost: called once if the browser takes the WebGL context away later; boot falls back.
 * makeRenderer exists for unit tests (Node has no WebGL).
 */
export async function start(canvas, data, { mode = "normal", signal, onLost, makeRenderer } = {}) {
  // --- State (all of it, before anything reads it) ---
  const doc = canvas.ownerDocument;
  const win = doc.defaultView;
  const html = doc.documentElement;
  const probe = win.__u3d; // test and debug mode only
  const disposables = [];
  const cleanups = [];
  const reduced = !!win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const rotate = mode !== "test" && !reduced; // idle motion: never in test mode or under reduced motion
  const jump = mode === "test" || reduced; // no easing: tests read a settled state, and reduced motion asks for it
  const meter = createMeter(2000);
  let renderer = null;
  let raf = 0;
  let stopped = false;
  let needRead = true;
  let last = 0; // time of the last drawn frame
  let view = null;
  let phone = null;
  let quiet = false;
  let opacity = 1;
  let eased = 0;
  let move = null; // { t0 } while easing; the start and end live in the buffers below
  const pose = { cam: [0, 0, 0], tgt: [0, 0, 0] };
  const moveFrom = { cam: [0, 0, 0], tgt: [0, 0, 0] };
  let moveTo = null;
  let positions = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (raf) win.cancelAnimationFrame(raf);
    raf = 0;
    for (const undo of cleanups.splice(0)) undo();
    for (const d of disposables.splice(0)) d.dispose();
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer = null;
    }
  };
  const gone = () => stopped || signal?.aborted || !canvas.isConnected;

  try {
    if (signal?.aborted) throw new Error("aborted before start");
    signal?.addEventListener("abort", stop, { once: true });
    cleanups.push(() => signal?.removeEventListener("abort", stop));

    // --- The scene ---
    renderer = makeRenderer ? makeRenderer(canvas) : new WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    const scene = new Scene();
    scene.background = new Color(BACKGROUND);
    const camera = new PerspectiveCamera(55, 1, 0.1, 100);
    const net = buildNetwork(data, mulberry32(data.seed ?? 2026));
    const { nodes, links } = net;
    const world = new Group();
    const { group: nodeGroup, slots } = nodeMeshes(nodes, disposables);
    const lines = linkLines(links, disposables);
    const journey = journeyParts(data.journey || [], disposables);
    const pulses = createPulses({ links, seed: data.seed ?? 2026, disposables });
    world.add(nodeGroup, lines, journey.group, pulses.mesh);
    scene.add(world);
    const morph = createMorph(nodes.length * 3);

    // Opacity per view and quiet sections (R18): on the materials, never on canvas.style (that is the fade-in).
    const materials = disposables.filter((d) => d.isMaterial).map((m) => ({ m, base: m.opacity }));
    for (const { m } of materials) m.transparent = true;
    const applyOpacity = (f) => {
      opacity = f;
      for (const { m, base } of materials) m.opacity = base * f;
    };

    // Node positions, and their links (a morph between views moves nodes, then their links).
    const dummy = new Object3D();
    const setPositions = (pos) => {
      positions = pos;
      const touched = new Set();
      slots.forEach(({ mesh, k }, i) => {
        dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        dummy.updateMatrix();
        mesh.setMatrixAt(k, dummy.matrix);
        touched.add(mesh);
      });
      for (const mesh of touched) mesh.instanceMatrix.needsUpdate = true;
      const attr = lines.geometry.attributes.position;
      for (let j = 0; j < links.length; j++) {
        const a = links[j][0] * 3, b = links[j][1] * 3;
        attr.array.set(pos.subarray(a, a + 3), j * 6);
        attr.array.set(pos.subarray(b, b + 3), j * 6 + 3);
      }
      attr.needsUpdate = true;
    };
    setPositions(layout(net, "network", data));

    const placePulse = (progress) => {
      const { step, t } = journeyAt(progress, journey.points.length);
      const a = journey.points[step], b = journey.points[Math.min(step + 1, journey.points.length - 1)];
      journey.pulse.position.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    };

    // Stage labels.
    const hubIndex = new Map();
    nodes.forEach((n, i) => n.kind === "hub" && hubIndex.set(n.team, i));
    const stepIndex = new Map((data.journey || []).map((st, i) => [st.id, i]));
    const anchorPoint = (anchor) => {
      const [kind, id] = anchor.split(":");
      if (kind === "team" && hubIndex.has(id)) { const i = hubIndex.get(id) * 3; return [positions[i], positions[i + 1], positions[i + 2]]; }
      if (kind === "hour") return hourPoint(Number(id));
      if (kind === "step" && stepIndex.has(id)) return journey.points[stepIndex.get(id)];
      return null;
    };
    const overlayEl = doc.getElementById?.("u3d-overlay") ?? null;
    const overlay = overlayEl ? createOverlay({ doc, win, el: overlayEl, anchorPoint }) : null;
    cleanups.push(() => overlay?.clear());
    cleanups.push(() => { html.removeAttribute("data-u3d-view"); html.removeAttribute("data-u3d-quiet"); html.removeAttribute("data-u3d-fps"); });

    // Debug mode: a small frame-rate box (N4: 30 on a mid-range phone, 50 on a laptop).
    let debugBox = null;
    if (mode === "debug" && doc.body) {
      debugBox = doc.createElement("div");
      debugBox.id = "u3d-debug";
      debugBox.setAttribute("aria-hidden", "true");
      doc.body.append(debugBox);
      cleanups.push(() => debugBox.remove());
    }

    // --- Camera ---
    const poseFor = (name) => {
      const v = viewFor(name, { phone: win.innerWidth < PHONE_MAX });
      return { cam: [v.camera[0] - v.offset, v.camera[1], v.camera[2]], tgt: [v.target[0] - v.offset, v.target[1], v.target[2]] };
    };
    const apply = () => {
      camera.position.set(pose.cam[0], pose.cam[1], pose.cam[2]);
      camera.lookAt(pose.tgt[0], pose.tgt[1], pose.tgt[2]);
    };
    const setPose = (p) => {
      for (let i = 0; i < 3; i++) { pose.cam[i] = p.cam[i]; pose.tgt[i] = p.tgt[i]; }
    };

    // --- Reading the page (on scroll and resize, once per frame at most) ---
    const sectionEls = [...doc.querySelectorAll("[data-scene]")]; // static pages: query once
    const readSections = () => {
      needRead = false;
      const sections = sectionEls.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          top: r.top, bottom: r.bottom, view: el.getAttribute("data-scene"),
          labels: el.hasAttribute("data-scene-labels"), quiet: el.hasAttribute("data-scene-quiet"),
        };
      });
      const picked = pickView(sections, win.innerHeight);
      const at = pickIndex(sections, win.innerHeight);
      const nowPhone = win.innerWidth < PHONE_MAX;
      const stageEl = picked.labels && at >= 0 ? sectionEls[at] : null;
      if (overlay) {
        overlay.update(stageEl ? `${at}:${nowPhone}` : null, stageEl, nowPhone);
        overlay.readCards();
      }
      const viewChanged = picked.view !== view;
      if (viewChanged || nowPhone !== phone) {
        const first = view === null;
        view = picked.view;
        phone = nowPhone;
        html.setAttribute("data-u3d-view", view);
        moveTo = poseFor(view);
        const target = layout(net, view, data);
        if (first || jump) {
          move = null;
          setPose(moveTo);
          if (!first || view !== "network") setPositions(target);
        } else {
          for (let i = 0; i < 3; i++) { moveFrom.cam[i] = pose.cam[i]; moveFrom.tgt[i] = pose.tgt[i]; }
          morph.begin(positions, target);
          moveTo.positions = target;
          move = { t0: null };
          eased++;
        }
      }
      journey.group.visible = view === "journey" && picked.labels && !!journey.pulse;
      if (journey.group.visible) placePulse(picked.progress);
      if (picked.quiet !== quiet || viewChanged) {
        quiet = picked.quiet;
        if (quiet) html.setAttribute("data-u3d-quiet", "");
        else html.removeAttribute("data-u3d-quiet");
        applyOpacity(viewFor(view).opacity * (quiet ? QUIET : 1));
      }
      if (probe) Object.assign(probe, { view, progress: picked.progress, quiet, opacity });
    };

    // --- The loop ---
    const draw = () => renderer && renderer.render(scene, camera);
    const idling = () => rotate && !quiet; // idle motion pauses while a quiet section is in the middle
    const frame = (t) => {
      raf = 0;
      if (stopped) return;
      // 30 fps cap: an idle-only frame that comes too soon is skipped, and the loop goes on.
      if (!needRead && !move && last && t - last < IDLE_MS) {
        if (idling() && !doc.hidden) raf = win.requestAnimationFrame(frame);
        return;
      }
      if (needRead) readSections();
      if (move) {
        if (move.t0 === null) move.t0 = t;
        const k = Math.min((t - move.t0) / MOVE_MS, 1);
        const e = ease(k);
        lerpInto(pose.cam, moveFrom.cam, moveTo.cam, e);
        lerpInto(pose.tgt, moveFrom.tgt, moveTo.tgt, e);
        setPositions(k >= 1 ? moveTo.positions : morph.at(e));
        if (k >= 1) move = null;
      }
      apply();
      if (last) {
        const dt = Math.min(t - last, 50);
        meter.add(t - last);
        if (idling()) {
          world.rotation.y += dt * 0.00004;
          pulses.step(dt, positions);
        }
      }
      last = t;
      draw();
      overlay?.place(camera, world);
      if (probe) {
        const fps = meter.fps();
        Object.assign(probe, { moving: !!move, eased, pulses: pulses.launched(), fps, camera: [...pose.cam] });
        html.setAttribute("data-u3d-fps", String(fps));
        if (debugBox) debugBox.textContent = `${fps} fps · ${html.getAttribute("data-u3d-tier") ?? "full"} · ${view}`;
      }
      if ((idling() || move) && !doc.hidden) raf = win.requestAnimationFrame(frame);
    };
    const requestDraw = () => {
      if (!raf && !stopped && !doc.hidden) raf = win.requestAnimationFrame(frame);
    };

    // --- Events ---
    const resize = () => {
      const w = win.innerWidth, h = win.innerHeight;
      needRead = true;
      renderer.setSize(w, h, false); // clears the drawing buffer: draw again
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      requestDraw();
    };
    resize();
    win.addEventListener("resize", resize);
    cleanups.push(() => win.removeEventListener("resize", resize));
    const onVisibility = () => {
      last = 0; // no time jump after a hidden spell
      meter.reset();
      requestDraw();
    };
    doc.addEventListener("visibilitychange", onVisibility);
    cleanups.push(() => doc.removeEventListener("visibilitychange", onVisibility));
    const onScroll = () => {
      needRead = true;
      requestDraw();
    };
    win.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => win.removeEventListener("scroll", onScroll));
    // Label sizes are measured when built; the web font may arrive later and widen them: build again then.
    doc.fonts?.ready?.then(() => {
      if (stopped) return;
      overlay?.invalidate();
      needRead = true;
      requestDraw();
    });
    // The browser can take the context away (GPU reset, too many tabs): stop and let boot fall back.
    const onContextLost = () => {
      if (stopped) return;
      try {
        stop();
      } finally {
        onLost?.(); // fall back even if clean-up fails on a dead context
      }
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    cleanups.push(() => canvas.removeEventListener("webglcontextlost", onContextLost));

    // --- First frame ---
    if (raf) win.cancelAnimationFrame(raf), (raf = 0); // the first draw below replaces resize's request
    readSections();
    apply();
    draw(); // a throw here (shader, context) lands in catch: the page stays static
    overlay?.place(camera, world);
    if (probe) Object.assign(probe, { moving: false, eased, pulses: 0, camera: [...pose.cam] });
    // A background tab gets no animation frames; the frame above is drawn, so do not wait for one there.
    if (!doc.hidden) await nextFrame(win);
    if (gone()) throw new Error("stopped before the first frame");

    canvas.style.opacity = "0";
    if (!reduced) canvas.style.transition = `opacity ${FADE_MS}ms ease`;
    html.setAttribute("data-u3d-tier", "full");
    html.classList.add("u3d-on");
    html.setAttribute("data-u3d-state", "on");
    if (idling()) requestDraw();
    const fade = win.requestAnimationFrame(() => (canvas.style.opacity = "1"));
    cleanups.push(() => win.cancelAnimationFrame(fade));
    return { stop };
  } catch (err) {
    stop();
    throw err;
  }
}
