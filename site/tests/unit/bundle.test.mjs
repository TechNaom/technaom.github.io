// N3, R14: sizes and origins of what the built site ships. Runs after `npx astro build`; skips when dist/ is missing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "../../dist");
const built = existsSync(join(DIST, "index.html"));
const skip = built ? false : "dist/ is missing: run `npx astro build` first";

const KB = 1024;
const THREE = /Three\.js Authors|WebGLRenderer/;
const ALLOWED_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);
const FETCHED_RELS = new Set(["stylesheet", "preload", "modulepreload", "prefetch", "icon", "apple-touch-icon", "manifest"]);
const gz = (s) => gzipSync(Buffer.from(s)).length;
const read = (p) => readFileSync(p, "utf8");
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

function bootScript() {
  const assets = join(DIST, "_astro");
  for (const f of readdirSync(assets).filter((f) => f.endsWith(".js"))) {
    const src = read(join(assets, f));
    if (src.includes("u3d-data")) return { name: f, src };
  }
  const html = read(join(DIST, "index.html"));
  for (const m of html.matchAll(/<script type="module"[^>]*>([\s\S]*?)<\/script>/g)) if (m[1].includes("u3d-data")) return { name: "inline in index.html", src: m[1] };
  return null;
}

/** Every URL the browser fetches from one page, by the rules on the T6 card. */
export function fetchedUrls(html) {
  const urls = [];
  // Quoted or unquoted attribute values.
  const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find((v) => v !== undefined);
  const srcset = (v) => (v || "").split(",").map((part) => part.trim().split(/\s+/)[0]);
  for (const [tag] of html.matchAll(/<(script|img|source|iframe|video|audio|track|embed)\b[^>]*>/gi)) {
    urls.push(attr(tag, "src"), attr(tag, "poster"), ...srcset(attr(tag, "srcset")));
  }
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attr(tag, "rel") || "").toLowerCase().split(/\s+/);
    if (rel.some((r) => FETCHED_RELS.has(r))) urls.push(attr(tag, "href"), ...srcset(attr(tag, "imagesrcset")));
  }
  for (const [, css] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) urls.push(...cssUrls(css));
  for (const [tag] of html.matchAll(/<[a-z][^>]*\sstyle\s*=[^>]*>/gi)) urls.push(...cssUrls(attr(tag, "style") || ""));
  return urls.filter(Boolean);
}

/** url(...) and @import "..." in a stylesheet. */
export function cssUrls(css) {
  const out = [];
  for (const [, , u] of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) out.push(u.trim());
  for (const [, u] of css.matchAll(/@import\s+['"]([^'"]+)['"]/g)) out.push(u);
  return out;
}

const foreign = (u) => {
  if (u.startsWith("data:") || u.startsWith("#")) return false;
  if (!/^(https?:)?\/\//.test(u)) return false; // relative or root-relative: our own origin
  return !ALLOWED_HOSTS.has(new URL(u, "https://self.invalid").host);
};

test("fetchedUrls finds scripts, styles, icons, images and inline url(), and ignores links", () => {
  const html = `<a href="https://x.example/a">x</a><link rel="canonical" href="https://x.example/c"><meta property="og:image" content="https://x.example/i">
    <script src="https://evil.example/s.js"></script><link rel="stylesheet" href="/s.css"><link rel="icon" href="data:image/svg+xml,x">
    <img src="https://cdn.example/i.png"><style>body{background:url("https://bg.example/b.png")}</style>
    <script src=https://bare.example/s.js></script><img srcset="/a.png 1x, https://set.example/b.png 2x">
    <iframe src="https://frame.example/"></iframe><video poster="https://poster.example/p.jpg"></video>
    <div style="background:url(https://inline.example/x.png)"></div><link rel="manifest" href="https://man.example/m.json">
    <link rel="apple-touch-icon" href="https://touch.example/t.png"><link rel="prefetch" href="https://pre.example/p.js">`;
  const urls = fetchedUrls(html);
  assert.deepEqual(urls.filter(foreign).sort(), [
    "https://bare.example/s.js", "https://bg.example/b.png", "https://cdn.example/i.png", "https://evil.example/s.js",
    "https://frame.example/", "https://inline.example/x.png", "https://man.example/m.json", "https://poster.example/p.jpg",
    "https://pre.example/p.js", "https://set.example/b.png", "https://touch.example/t.png",
  ]);
  assert.deepEqual(cssUrls(`@import "https://imp.example/a.css"; a{b:url( '/own.png' )}`), ["/own.png", "https://imp.example/a.css"]);
  assert.ok(!urls.some((u) => u.includes("x.example")));
});

test("the boot script is small and has no three.js in it", { skip }, () => {
  const boot = bootScript();
  assert.ok(boot, "a script that refers to u3d-data");
  assert.doesNotMatch(boot.src, THREE, `${boot.name} must not contain three.js`);
  assert.ok(gz(boot.src) <= 3 * KB, `${boot.name} is ${gz(boot.src)} bytes gzipped (limit 3 KB)`);
});

test("the three.js chunk is at most 180 KB gzipped and keeps its licence", { skip }, () => {
  const assets = join(DIST, "_astro");
  const chunks = readdirSync(assets).filter((f) => f.endsWith(".js") && THREE.test(read(join(assets, f))));
  assert.equal(chunks.length, 1, `three.js lives in exactly one chunk, found: ${chunks.join(", ")}`);
  const src = read(join(assets, chunks[0]));
  assert.ok(gz(src) <= 180 * KB, `${chunks[0]} is ${Math.round(gz(src) / KB)} KB gzipped (limit 180 KB)`);
  assert.match(src, /SPDX-License-Identifier: MIT|@license/);
});

test("every page and stylesheet fetches only from our own origin and Google Fonts", { skip }, () => {
  const pages = walk(DIST).filter((f) => f.endsWith(".html"));
  assert.ok(pages.length >= 7, `found ${pages.length} pages`);
  const bad = pages.flatMap((p) => fetchedUrls(read(p)).filter(foreign).map((u) => `${p.slice(DIST.length)}: ${u}`));
  const sheets = walk(DIST).filter((f) => f.endsWith(".css"));
  bad.push(...sheets.flatMap((p) => cssUrls(read(p)).filter(foreign).map((u) => `${p.slice(DIST.length)}: ${u}`)));
  assert.deepEqual(bad, []);
  // JS chunks are not scanned for URLs here (three.js carries docs links in strings); T17 checks the real network log.
});
