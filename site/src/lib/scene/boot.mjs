// The small, always-loaded start of the 3D scene (R14, R17). It decides whether to start, waits until
// the page is idle, then loads the scene chunk. Anything that fails leaves the static page as it is.
// No three.js import here: three.js lives only in the lazy scene chunk.

/** "start", "off" (the visitor chose less data) or "fallback" (the device cannot run it). */
export function shouldStart({ webgl, saveData }) {
  if (saveData) return "off";
  return webgl ? "start" : "fallback";
}

/** "test", "debug" or "normal", from the page's query string. */
export function modeFrom(search) {
  const m = new URLSearchParams(search || "").get("u3d");
  return m === "test" || m === "debug" ? m : "normal";
}

function hasWebGL2(doc, win) {
  try {
    if (!win.WebGL2RenderingContext) return false;
    const gl = doc.createElement("canvas").getContext("webgl2"); // a throwaway probe, not the scene's canvas
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function whenIdle(doc, win) {
  return new Promise((resolve) => {
    const go = () => (win.requestIdleCallback ? win.requestIdleCallback(() => resolve(), { timeout: 2000 }) : win.setTimeout(resolve, 300));
    if (doc.readyState === "complete") go();
    else win.addEventListener("load", go, { once: true });
  });
}

/** Rejects after ms milliseconds, so a scene that never answers cannot leave the page "loading". */
const within = (promise, ms) => {
  let timer;
  const limit = new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(`no answer in ${ms} ms`)), ms)));
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
};

/**
 * Start the scene if this visitor and device should have it. Every path ends in a settled state:
 * "off", "fallback", or the scene's own ("on"). `load` and `limitMs` exist for tests.
 */
export async function boot(doc = document, win = window, { load = () => import("./scene.mjs"), limitMs = 15000 } = {}) {
  const html = doc.documentElement;
  const state = (s) => html.setAttribute("data-u3d-state", s);
  const canvas = doc.getElementById("u3d-canvas");
  const stop = (s) => {
    html.classList.remove("u3d-on");
    html.removeAttribute("data-u3d-tier");
    canvas?.remove();
    state(s);
  };
  let mode = "normal";
  try {
    mode = modeFrom(win.location.search);
    const dataEl = doc.getElementById("u3d-data");
    state("idle");
    if (!canvas || !dataEl) return stop("fallback");
    const saveData = win.navigator.connection?.saveData === true;
    if (saveData) return stop("off"); // the visitor's choice; costs nothing to check
    // Creating a WebGL context is real work on weak devices: only after the page has loaded and is idle (R14).
    await whenIdle(doc, win);
    const decision = shouldStart({ webgl: hasWebGL2(doc, win), saveData });
    if (decision !== "start") return stop(decision);
    state("loading");
    const data = JSON.parse(dataEl.textContent || "{}");
    if (mode !== "normal") win.__u3d = { data, view: null, tier: "full", progress: 0, quiet: false, moving: false, pulses: 0 };
    const { start } = await within(load(), limitMs);
    // T6 contract: start() cleans up after itself if it fails, and sets "on" itself after the first frame.
    // If boot stops waiting, the abort tells the scene to stop itself, so a late start never turns "on".
    const giveUp = new AbortController();
    try {
      await within(start(canvas, data, { mode, signal: giveUp.signal, onLost: () => stop("fallback") }), limitMs);
    } catch (err) {
      giveUp.abort();
      throw err;
    }
  } catch (err) {
    if (mode !== "normal") console.warn("[u3d] fallback:", err);
    stop("fallback");
  }
}
