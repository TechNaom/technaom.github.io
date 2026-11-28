// The lazy scene chunk (R9, N3): the only file that imports three.js. boot.mjs loads it after the page
// is idle and calls start(). Contract with boot: start() sets data-u3d-state="on" itself after the first
// frame, returns { stop }, and cleans up after itself (loop, listeners, WebGL context) if anything throws.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Object3D, Group,
  InstancedMesh, IcosahedronGeometry, MeshBasicMaterial,
  BufferGeometry, Float32BufferAttribute, LineSegments, LineBasicMaterial,
} from "three";
import { mulberry32 } from "./rng.mjs";
import { buildNetwork } from "./network.mjs";
import { pickView, viewFor } from "./views.mjs";

const MAX_PIXEL_RATIO = 1.5;
const FADE_MS = 600;
const MOVE_MS = 800;
const PHONE_MAX = 900;
const BACKGROUND = 0x0f1828; // --paper in the dark theme

// Colours come from the site's dark palette (--amber, --cyan, --muted).
const LOOK = {
  core: { color: 0xf4a640, size: 0.55 },
  hub: { color: 0x7fd0ea, size: 0.28 },
  agent: { color: 0xc7e9f5, size: 0.1 },
  field: { color: 0x9aa8be, size: 0.07 },
};

const nextFrame = (win) => new Promise((resolve) => win.requestAnimationFrame(() => resolve()));

/** One InstancedMesh per node kind: four draw calls, whatever the node count. */
function nodeMeshes(nodes, disposables) {
  const group = new Group();
  const dummy = new Object3D();
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
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
  return group;
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

    const { nodes, links } = buildNetwork(data, mulberry32(data.seed ?? 2026));
    const world = new Group();
    world.add(nodeMeshes(nodes, disposables), linkLines(nodes, links, disposables));
    scene.add(world);

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
    const readSections = () => {
      needRead = false;
      const sections = [...doc.querySelectorAll("[data-scene]")].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          top: r.top, bottom: r.bottom, view: el.getAttribute("data-scene"),
          labels: el.hasAttribute("data-scene-labels"), quiet: el.hasAttribute("data-scene-quiet"),
        };
      });
      const picked = pickView(sections, win.innerHeight);
      const nowPhone = win.innerWidth < PHONE_MAX;
      if (picked.view !== view || nowPhone !== phone) {
        const first = view === null;
        view = picked.view;
        phone = nowPhone;
        html.setAttribute("data-u3d-view", view);
        const to = poseFor(view);
        if (first || jump) {
          move = null;
          pose = to;
        } else {
          move = { from: pose, to, t0: null };
        }
      }
      if (probe) Object.assign(probe, { view, progress: picked.progress, moving: !!move });
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
        if (k >= 1) move = null;
        if (probe) probe.moving = !!move;
      }
      apply();
      if (rotate && last) world.rotation.y += Math.min(t - last, 50) * 0.00004;
      last = t;
      draw();
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
    const onContextLost = (e) => {
      e?.preventDefault?.();
      if (stopped) return;
      stop();
      onLost?.();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    cleanups.push(() => canvas.removeEventListener("webglcontextlost", onContextLost));

    if (raf) win.cancelAnimationFrame(raf), (raf = 0); // the first draw below replaces resize's request
    readSections();
    apply();
    draw(); // a throw here (shader, context) lands in catch: the page stays static
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
