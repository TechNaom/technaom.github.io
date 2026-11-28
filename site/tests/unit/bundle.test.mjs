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
  const attr = (tag, name) => tag.match(new RegExp(`\\s${name}=("([^"]*)"|'([^']*)')`))?.slice(2).find((v) => v !== undefined);
  for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) attr(tag, "src") && urls.push(attr(tag, "src"));
  for (const [tag] of html.matchAll(/<(img|source)\b[^>]*>/g)) attr(tag, "src") && urls.push(attr(tag, "src"));
  for (const [tag] of html.matchAll(/<link\b[^>]*>/g)) {
    const rel = (attr(tag, "rel") || "").split(/\s+/);
    if (rel.some((r) => ["stylesheet", "preload", "modulepreload", "icon"].includes(r))) urls.push(attr(tag, "href"));
  }
  for (const [, css] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) for (const [, , u] of css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) urls.push(u);
  return urls.filter(Boolean);
}

const foreign = (u) => {
  if (u.startsWith("data:") || u.startsWith("#")) return false;
  if (!/^(https?:)?\/\//.test(u)) return false; // relative or root-relative: our own origin
  return !ALLOWED_HOSTS.has(new URL(u, "https://self.invalid").host);
};

test("fetchedUrls finds scripts, styles, icons, images and inline url(), and ignores links", () => {
  const html = `<a href="https://x.example/a">x</a><link rel="canonical" href="https://x.example/c"><meta property="og:image" content="https://x.example/i">
    <script src="https://evil.example/s.js"></script><link rel="stylesheet" href="/s.css"><link rel="icon" href="data:image/svg+xml,x">
    <img src="https://cdn.example/i.png"><style>body{background:url("https://bg.example/b.png")}</style>`;
  const urls = fetchedUrls(html);
  assert.deepEqual(urls.filter(foreign), ["https://evil.example/s.js", "https://cdn.example/i.png", "https://bg.example/b.png"]);
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

test("every page fetches only from our own origin and Google Fonts", { skip }, () => {
  const pages = walk(DIST).filter((f) => f.endsWith(".html"));
  assert.ok(pages.length >= 7, `found ${pages.length} pages`);
  const bad = pages.flatMap((p) => fetchedUrls(read(p)).filter(foreign).map((u) => `${p.slice(DIST.length)}: ${u}`));
  assert.deepEqual(bad, []);
});
