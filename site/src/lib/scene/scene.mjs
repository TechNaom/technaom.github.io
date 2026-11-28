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

const MAX_PIXEL_RATIO = 1.5;
const FADE_MS = 600;
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
 * start(canvas, data, { mode }) → Promise<{ stop() }>.
 * mode "test" turns idle rotation off, so screenshots and checks see a still scene.
 */
export async function start(canvas, data, { mode = "normal" } = {}) {
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
    for (const undo of cleanups.splice(0)) undo();
    for (const d of disposables.splice(0)) d.dispose();
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer = null;
    }
  };

  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    const scene = new Scene();
    scene.background = new Color(BACKGROUND);
    const camera = new PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 3, 22);
    camera.lookAt(0, 0, 0);

    const { nodes, links } = buildNetwork(data, mulberry32(data.seed ?? 2026));
    const world = new Group();
    world.add(nodeMeshes(nodes, disposables), linkLines(nodes, links, disposables));
    scene.add(world);

    const resize = () => {
      const w = win.innerWidth, h = win.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    win.addEventListener("resize", resize);
    cleanups.push(() => win.removeEventListener("resize", resize));

    const rotate = mode !== "test" && !win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let last = 0;
    const frame = (t) => {
      raf = 0;
      if (stopped) return;
      if (rotate && last) world.rotation.y += Math.min(t - last, 50) * 0.00004;
      last = t;
      renderer.render(scene, camera);
      if (!doc.hidden) raf = win.requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      if (!doc.hidden && !raf && !stopped) {
        last = 0;
        raf = win.requestAnimationFrame(frame);
      }
    };
    doc.addEventListener("visibilitychange", onVisibility);
    cleanups.push(() => doc.removeEventListener("visibilitychange", onVisibility));

    renderer.render(scene, camera); // a throw here (shader, context) lands in catch: the page stays static
    // A background tab gets no animation frames; the frame above is drawn, so do not wait for one there.
    if (!doc.hidden) await nextFrame(win);
    if (stopped) throw new Error("stopped before the first frame");

    const reduced = win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    canvas.style.opacity = "0";
    if (!reduced) canvas.style.transition = `opacity ${FADE_MS}ms ease`;
    html.setAttribute("data-u3d-tier", "full");
    html.classList.add("u3d-on");
    html.setAttribute("data-u3d-state", "on");
    raf = win.requestAnimationFrame(frame);
    win.requestAnimationFrame(() => (canvas.style.opacity = "1"));
    return { stop };
  } catch (err) {
    stop();
    throw err;
  }
}
