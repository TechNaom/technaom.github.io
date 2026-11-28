// The lazy scene chunk (R9, N3): the only file that imports three.js. boot.mjs loads it after the page
// is idle and calls start(). Contract with boot: start() sets data-u3d-state="on" itself after the first
// frame, returns { stop }, and cleans up after itself (loop, listeners, WebGL context) if anything throws.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Object3D, Group,
  InstancedMesh, IcosahedronGeometry, MeshBasicMaterial,
  BufferGeometry, Float32BufferAttribute, LineSegments, LineBasicMaterial, Line, Mesh, Vector3,
} from "three";
import { mulberry32 } from "./rng.mjs";
import { buildNetwork } from "./network.mjs";
import { pickView, pickIndex, viewFor } from "./views.mjs";
import { layout, hourPoint } from "./layout.mjs";
import { toScreen, declutter } from "./labels.mjs";
import { journeyAt, journeyPoints } from "./journey.mjs";

const MAX_PIXEL_RATIO = 1.5;
const FADE_MS = 600;
const MOVE_MS = 800;
const PHONE_MAX = 900;
const PULSES = 24; // signals in flight at once (R11): a fixed pool, no allocation per frame
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
 * slots[i] = { mesh, k }: where node i lives, so a morph can move it.
 */
function nodeMeshes(nodes, disposables) {
  const group = new Group();
  const dummy = new Object3D();
  const slots = new Array(nodes.length);
  for (const [kind, look] of Object.entries(LOOK)) {
    const mine = nodes.filter((n) => n.kind === kind);
    if (!mine.length) continue;
    const geometry = new IcosahedronGeometry(look.size, kind === "core" ? 2 : 1);
    const material = new MeshBasicMaterial({ color: look.color, transparent: kind === "field", opacity: kind === "field" ? 0.6 : 1 });
    disposables.push(geometry, material);
    const mesh = new InstancedMesh(geometry, material, mine.length);
    disposables.push(mesh);
    mine.forEach((n, i) => {
      dummy.position.set(n.pos[0], n.pos[1], n.pos[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    nodes.forEach((n, i) => n.kind === kind && (slots[i] = { mesh, k: mine.indexOf(n) }));
    mesh.instanceMatrix.needsUpdate = true;
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
function linkLines(nodes, links, disposables) {
  const positions = new Float32Array(links.length * 6);
  links.forEach(([a, b], k) => {
    positions.set(nodes[a].pos, k * 6);
    positions.set(nodes[b].pos, k * 6 + 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({ color: 0x7fd0ea, transparent: true, opacity: 0.22 });
  disposables.push(geometry, material);
  return new LineSegments(geometry, material);
}

/**
 * start(canvas, data, { mode, signal, onLost }) → Promise<{ stop() }>.
 * mode "test" keeps the scene still (no idle rotation), so checks and screenshots see one picture.
 * signal: boot aborts it when it stops waiting; the scene then stops itself and never turns "on".
 * onLost: called once if the browser takes the WebGL context away later; boot falls back.
 * The view follows the [data-scene] section in the middle of the screen (views.mjs).
 * makeRenderer exists for unit tests (Node has no WebGL).
 */
export async function start(canvas, data, { mode = "normal", signal, onLost, makeRenderer } = {}) {
  const doc = canvas.ownerDocument;
  const win = doc.defaultView;
  const html = doc.documentElement;
  const disposables = [];
  const cleanups = [];
  let renderer = null;
  let raf = 0;
  let stopped = false;

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

    renderer = makeRenderer ? makeRenderer(canvas) : new WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    const scene = new Scene();
    scene.background = new Color(BACKGROUND);
    const camera = new PerspectiveCamera(55, 1, 0.1, 100);

    const net = buildNetwork(data, mulberry32(data.seed ?? 2026));
    const { nodes, links } = net;
    const world = new Group();
    const { group: nodeGroup, slots } = nodeMeshes(nodes, disposables);
    const lines = linkLines(nodes, links, disposables);
    // Nodes move between views, so cached bounding spheres go stale: always draw (a handful of draw calls).
    lines.frustumCulled = false;
    nodeGroup.children.forEach((m) => (m.frustumCulled = false));
    world.add(nodeGroup, lines);
    scene.add(world);
    const journey = journeyParts(data.journey || [], disposables);
    world.add(journey.group);
    const placePulse = (progress) => {
      const { step, t } = journeyAt(progress, journey.points.length);
      const a = journey.points[step], b = journey.points[Math.min(step + 1, journey.points.length - 1)];
      journey.pulse.position.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    };

    // Signals (R11): small pulses travel along random links while the scene is idle-animating.
    const pulseRand = mulberry32((data.seed ?? 2026) + 1);
    const pulseGeo = new IcosahedronGeometry(0.09, 1);
    const pulseMat = new MeshBasicMaterial({ color: 0xe8f6fc });
    const pulseMesh = new InstancedMesh(pulseGeo, pulseMat, PULSES);
    pulseMesh.frustumCulled = false;
    disposables.push(pulseGeo, pulseMat, pulseMesh);
    world.add(pulseMesh);
    const pulseState = Array.from({ length: PULSES }, () => ({ link: 0, t: 1, speed: 0 })); // t >= 1: free
    let pulses = 0;
    const pulseDummy = new Object3D();
    const stepPulses = (dt) => {
      if (!links.length) return;
      for (let i = 0; i < PULSES; i++) { // a plain loop: no closures or arrays per frame
        const st = pulseState[i];
        if (st.t >= 1) {
          if (pulseRand() > dt / 400) { // a free slot launches about once every 400 ms
            pulseDummy.position.set(0, 0, -1000);
            pulseDummy.updateMatrix();
            pulseMesh.setMatrixAt(i, pulseDummy.matrix);
            continue;
          }
          st.link = Math.floor(pulseRand() * links.length);
          st.t = 0;
          st.speed = 0.0004 + pulseRand() * 0.0006;
          pulses++;
        }
        const link = links[st.link], a = link[0] * 3, b = link[1] * 3, k = st.t;
        pulseDummy.position.set(
          positions[a] + (positions[b] - positions[a]) * k,
          positions[a + 1] + (positions[b + 1] - positions[a + 1]) * k,
          positions[a + 2] + (positions[b + 2] - positions[a + 2]) * k,
        );
        st.t += dt * st.speed;
        pulseDummy.updateMatrix();
        pulseMesh.setMatrixAt(i, pulseDummy.matrix);
      }
      pulseMesh.instanceMatrix.needsUpdate = true;
      if (probe) probe.pulses = pulses;
    };
    pulseState.forEach((_, i) => { pulseDummy.position.set(0, 0, -1000); pulseDummy.updateMatrix(); pulseMesh.setMatrixAt(i, pulseDummy.matrix); });

    // Opacity per view and quiet sections (R18): on the materials, never on canvas.style (that is the fade-in).
    const materials = disposables.filter((d) => d.isMaterial).map((m) => ({ m, base: m.opacity }));
    for (const { m } of materials) m.transparent = true;
    let quiet = null;
    let opacity = 1;
    const applyOpacity = (f) => {
      opacity = f;
      for (const { m, base } of materials) m.opacity = base * f;
    };

    // Stage labels (T11): copies of the stage's HTML list, placed next to their anchors on every drawn frame.
    // The overlay is aria-hidden; the list stays in the page for screen readers and the copy gate.
    const overlay = doc.getElementById?.("u3d-overlay") ?? null;
    const hubIndex = new Map();
    nodes.forEach((n, i) => n.kind === "hub" && hubIndex.set(n.team, i));
    const stepIndex = new Map((data.journey || []).map((st, i) => [st.id, i]));
    let labelItems = [];
    let labelCards = []; // the stage's cards: no label may sit behind one (labels are under main)
    let labelKey = null;
    const anchorPoint = (anchor) => {
      const [kind, id] = anchor.split(":");
      if (kind === "team" && hubIndex.has(id)) { const i = hubIndex.get(id); return [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]; }
      if (kind === "hour") return hourPoint(Number(id));
      if (kind === "step" && stepIndex.has(id)) return journey.points[stepIndex.get(id)];
      return null;
    };
    const buildLabels = (stageEl, isPhone) => {
      if (!overlay) return;
      overlay.replaceChildren();
      labelItems = [];
      labelCards = [];
      if (!stageEl) return;
      labelCards = [...stageEl.querySelectorAll("[data-scene-card]")];
      for (const li of stageEl.querySelectorAll("ol.u3d-labels li[data-anchor]")) {
        const anchor = li.getAttribute("data-anchor");
        if (isPhone && anchor.startsWith("hour:")) continue; // phones: no hour labels (architecture point 14)
        const el = doc.createElement("div");
        el.className = "u3d-label";
        el.setAttribute("data-anchor", anchor);
        const name = doc.createElement("span");
        name.className = "lb-name";
        name.textContent = li.querySelector(".lb-name")?.textContent ?? "";
        el.append(name);
        const detail = li.querySelector(".lb-detail")?.textContent;
        if (detail && !isPhone) {
          const d = doc.createElement("span");
          d.className = "lb-detail";
          d.textContent = detail;
          el.append(d);
        }
        overlay.append(el);
        labelItems.push({ el, anchor, w: el.offsetWidth, h: el.offsetHeight });
      }
    };
    cleanups.push(() => overlay?.replaceChildren());
    cleanups.push(() => { html.removeAttribute("data-u3d-view"); html.removeAttribute("data-u3d-quiet"); });
    // Label sizes are measured when built; the web font may arrive later and widen them: build again then.
    doc.fonts?.ready?.then(() => {
      if (stopped) return;
      labelKey = null;
      needRead = true;
      requestDraw();
    });
    const v3 = new Vector3();
    const placeLabels = () => {
      if (!labelItems.length) return;
      const w = win.innerWidth, h = win.innerHeight;
      const cards = labelCards.map((c) => c.getBoundingClientRect()); // read layout before any write
      const behindCard = (b) => cards.some((r) => b.x < r.right && r.left < b.x + b.w && b.y < r.bottom && r.top < b.y + b.h);
      world.updateMatrixWorld();
      camera.updateMatrixWorld();
      const boxes = labelItems.map((it) => {
        const p = anchorPoint(it.anchor);
        if (!p) return { x: 0, y: 0, w: it.w, h: it.h, hidden: true };
        v3.set(p[0], p[1], p[2]).applyMatrix4(world.matrixWorld).project(camera);
        const sc = toScreen(v3, w, h);
        const box = { x: sc.x + 10, y: sc.y - it.h / 2, w: it.w, h: it.h };
        return { ...box, hidden: !sc.visible || behindCard(box) }; // a hidden label takes no space
      });
      declutter(boxes, { step: 14, centre: { x: w / 2, y: h / 2 } }).forEach((b, i) => {
        const inside = b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h;
        const st = labelItems[i].el.style;
        st.visibility = b.hidden || !inside || behindCard(b) ? "hidden" : "visible";
        st.transform = `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px)`;
      });
    };

    // Node positions now, and a writer for them (a morph between views moves nodes, then their links).
    let positions = layout(net, "network", data);
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
      links.forEach(([a, b], j) => {
        attr.array.set(pos.subarray(a * 3, a * 3 + 3), j * 6);
        attr.array.set(pos.subarray(b * 3, b * 3 + 3), j * 6 + 3);
      });
      attr.needsUpdate = true;
    };
    const mix = (from, to, k) => {
      const out = new Float32Array(from.length);
      for (let i = 0; i < from.length; i++) out[i] = from[i] + (to[i] - from[i]) * k;
      return out;
    };

    const reduced = !!win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const rotate = mode !== "test" && !reduced;
    const jump = mode === "test" || reduced; // no easing: tests read a settled state, and reduced motion asks for it
    const probe = win.__u3d; // set by boot in test and debug mode only
    let last = 0;

    // Camera pose per view. The offset moves camera and target left together, so the network sits right.
    const poseFor = (name) => {
      const v = viewFor(name, { phone: win.innerWidth < PHONE_MAX });
      return { cam: [v.camera[0] - v.offset, v.camera[1], v.camera[2]], tgt: [v.target[0] - v.offset, v.target[1], v.target[2]] };
    };
    let pose = poseFor("network");
    let move = null; // { from, to, t0 } while easing
    const apply = () => {
      camera.position.set(pose.cam[0], pose.cam[1], pose.cam[2]);
      camera.lookAt(pose.tgt[0], pose.tgt[1], pose.tgt[2]);
    };
    const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

    let view = null;
    let phone = null;
    let needRead = true;
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
      const stageEl = picked.labels && at >= 0 ? sectionEls[at] : null;
      const key = stageEl ? `${at}:${win.innerWidth < PHONE_MAX}` : null;
      if (key !== labelKey) {
        labelKey = key;
        buildLabels(stageEl, win.innerWidth < PHONE_MAX);
      }
      const nowPhone = win.innerWidth < PHONE_MAX;
      const viewChanged = picked.view !== view;
      if (picked.view !== view || nowPhone !== phone) {
        const first = view === null;
        view = picked.view;
        phone = nowPhone;
        html.setAttribute("data-u3d-view", view);
        const to = poseFor(view);
        const target = layout(net, view, data);
        if (first || jump) {
          move = null;
          pose = to;
          if (!first || view !== "network") setPositions(target);
        } else {
          move = { from: pose, to, posFrom: positions, posTo: target, t0: null };
          if (probe) probe.eased = (probe.eased ?? 0) + 1; // eased moves started (none in test mode or reduced motion)
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
      if (probe) Object.assign(probe, { view, progress: picked.progress, moving: !!move, quiet, opacity, pulses });
    };

    const draw = () => renderer && renderer.render(scene, camera);
    // A loop runs only while something moves (idle rotation, a camera move); otherwise one draw per change.
    const frame = (t) => {
      raf = 0;
      if (stopped) return;
      if (needRead) readSections();
      if (move) {
        if (move.t0 === null) move.t0 = t;
        const k = Math.min((t - move.t0) / MOVE_MS, 1);
        const e = ease(k);
        pose = { cam: lerp(move.from.cam, move.to.cam, e), tgt: lerp(move.from.tgt, move.to.tgt, e) };
        setPositions(k >= 1 ? move.posTo : mix(move.posFrom, move.posTo, e));
        if (k >= 1) move = null;
        if (probe) probe.moving = !!move;
      }
      apply();
      if (rotate && last) {
        const dt = Math.min(t - last, 50);
        world.rotation.y += dt * 0.00004;
        stepPulses(dt); // idle signals run only where idle rotation does: never in test mode or under reduced motion
      }
      last = t;
      draw();
      placeLabels();
      if ((rotate || move) && !doc.hidden) raf = win.requestAnimationFrame(frame);
    };
    const requestDraw = () => {
      if (!raf && !stopped && !doc.hidden) raf = win.requestAnimationFrame(frame);
    };

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
      last = 0;
      requestDraw();
    };
    doc.addEventListener("visibilitychange", onVisibility);
    cleanups.push(() => doc.removeEventListener("visibilitychange", onVisibility));
    // One layout read per animation frame, however many scroll events arrive.
    const onScroll = () => {
      needRead = true;
      requestDraw();
    };
    win.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => win.removeEventListener("scroll", onScroll));
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

    if (raf) win.cancelAnimationFrame(raf), (raf = 0); // the first draw below replaces resize's request
    readSections();
    apply();
    draw(); // a throw here (shader, context) lands in catch: the page stays static
    placeLabels();
    // A background tab gets no animation frames; the frame above is drawn, so do not wait for one there.
    if (!doc.hidden) await nextFrame(win);
    if (gone()) throw new Error("stopped before the first frame");

    canvas.style.opacity = "0";
    if (!reduced) canvas.style.transition = `opacity ${FADE_MS}ms ease`;
    html.setAttribute("data-u3d-tier", "full");
    html.classList.add("u3d-on");
    html.setAttribute("data-u3d-state", "on");
    if (rotate) requestDraw();
    const fade = win.requestAnimationFrame(() => (canvas.style.opacity = "1"));
    cleanups.push(() => win.cancelAnimationFrame(fade));
    return { stop };
  } catch (err) {
    stop();
    throw err;
  }
}
