import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Plugin } from "vite";

// Builds the PWA service worker at `vite build` time and writes it as
// `sw.js` into the output dir. Hand-rolled on purpose: the app is a small
// static SPA with a single API route, so a ~90-line worker with a
// build-generated precache list does the job without a new dependency
// (no vite-plugin-pwa / Workbox). It runs in the `writeBundle` hook —
// not `generateBundle`, where public-dir files and index.html are not
// yet on disk — so any `vite build` invocation (local, Vercel, CI)
// generates it from the real output.
//
// Caching strategy:
// - App shell + assets: precached on install (cache-first at runtime).
// - Navigations: network-first, falling back to the cached index.html
//   so the app still opens offline.
// - /api/* (the Otari proxy): never intercepted, always live.
// - Google Fonts: stale-while-revalidate in a separate cache.
// - Cache names are versioned by a content hash, so a new deploy
//   installs a fresh cache and the activate handler deletes the old one.
//   skipWaiting + clients.claim make the new worker take over promptly
//   instead of waiting for every tab to close.

export const SW_FILENAME = "sw.js";

// Public files that ship in the bundle but the app never fetches, so
// precaching them would only bloat the install download (verified
// 2026-11-13): the three carousel PNGs are unused — the 3D scene builds
// its textures procedurally on canvas — and the LXGW WenKai woff2
// subsets are unused (no @font-face references them).
const PRECACHE_EXCLUDE = new Set([
  "carousel-base.png",
  "carousel-column.png",
  "carousel-panels.png",
]);

function isPrecached(fileName: string): boolean {
  if (fileName === SW_FILENAME) return false;
  if (PRECACHE_EXCLUDE.has(fileName)) return false;
  if (fileName.startsWith("fonts/")) return false;
  return true;
}

/** Sorted, "./"-relative URLs for every file the worker precaches. */
export function buildPrecacheList(fileNames: string[]): string[] {
  return fileNames
    .filter(isPrecached)
    .sort()
    .map((name) => `./${name}`);
}

export interface BundleEntry {
  name: string;
  source: string | Uint8Array;
}

/** Short content hash over the precached files — changes iff any of them do. */
export function hashBundleContents(entries: BundleEntry[]): string {
  const hash = createHash("sha256");
  const sorted = [...entries].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of sorted) {
    hash.update(entry.name);
    hash.update(
      typeof entry.source === "string"
        ? entry.source
        : Buffer.from(entry.source),
    );
  }
  return hash.digest("hex").slice(0, 12);
}

/** The service worker source. No backticks / ${} inside — it is built with a template literal. */
export function buildSwSource(version: string, precache: string[]): string {
  const urls = JSON.stringify(precache);
  return [
    "// Generated at build time by scripts/pwa-sw-plugin.ts. Do not edit by hand.",
    'const VERSION = "' + version + '";',
    'const CACHE_NAME = "carousel-lamp-" + VERSION;',
    'const FONT_CACHE_NAME = "carousel-lamp-fonts-" + VERSION;',
    "const PRECACHE_URLS = " + urls + ";",
    "",
    'self.addEventListener("install", (event) => {',
    "  event.waitUntil(",
    "    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())",
    "  );",
    "});",
    "",
    'self.addEventListener("activate", (event) => {',
    "  event.waitUntil(",
    "    caches.keys()",
    "      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== FONT_CACHE_NAME).map((key) => caches.delete(key))))",
    "      .then(() => self.clients.claim())",
    "  );",
    "});",
    "",
    'self.addEventListener("fetch", (event) => {',
    "  const request = event.request;",
    "  const url = new URL(request.url);",
    "  // The Otari proxy is always live — never serve API calls from cache.",
    '  if (url.pathname.indexOf("/api/") === 0) return;',
    '  if (request.method !== "GET") return;',
    '  if (request.mode === "navigate") {',
    "    // App shell: fresh when online, cached index.html when offline.",
    '    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));',
    "    return;",
    "  }",
    "  if (url.origin === self.location.origin) {",
    "    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));",
    "    return;",
    "  }",
    '  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {',
    "    event.respondWith(",
    "      caches.open(FONT_CACHE_NAME).then((cache) =>",
    "        cache.match(request).then((cached) => {",
    "          const network = fetch(request).then((response) => {",
    "            if (response.ok) cache.put(request, response.clone());",
    "            return response;",
    "          });",
    "          return cached || network;",
    "        })",
    "      )",
    "    );",
    "  }",
    "});",
    "",
  ].join("\n");
}

/** Every file under `dir`, as posix-style paths relative to it (sorted). */
export function collectBundleFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const abs = join(current, name);
      if (statSync(abs).isDirectory()) {
        walk(abs);
      } else {
        out.push(relative(dir, abs).split(sep).join("/"));
      }
    }
  };
  walk(dir);
  return out.sort();
}

export default function carouselLampPwaSw(): Plugin {
  return {
    name: "carousel-lamp-pwa-sw",
    writeBundle(options) {
      const outDir = options.dir;
      if (!outDir) return;
      const files = collectBundleFiles(outDir);
      const precache = buildPrecacheList(files);
      const entries: BundleEntry[] = files
        .filter((name) => precache.includes(`./${name}`))
        .map((name) => ({ name, source: readFileSync(join(outDir, name)) }));
      const version = hashBundleContents(entries);
      writeFileSync(join(outDir, SW_FILENAME), buildSwSource(version, precache));
    },
  };
}
