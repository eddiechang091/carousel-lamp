import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPrecacheList,
  buildSwSource,
  collectBundleFiles,
  hashBundleContents,
} from "../../scripts/pwa-sw-plugin";

describe("buildPrecacheList", () => {
  it("prefixes files with ./ and sorts them", () => {
    expect(buildPrecacheList(["styles.css", "app.js", "index.html"])).toEqual([
      "./app.js",
      "./index.html",
      "./styles.css",
    ]);
  });

  it("excludes the worker itself and the unused public files", () => {
    expect(
      buildPrecacheList([
        "sw.js",
        "carousel-base.png",
        "carousel-column.png",
        "carousel-panels.png",
        "fonts/lxgwwenkailite-regular-subset-100.woff2",
        "fonts/OFL.txt",
        "favicon.png",
      ]),
    ).toEqual(["./favicon.png"]);
  });
});

describe("hashBundleContents", () => {
  it("is deterministic regardless of entry order", () => {
    const a = [
      { name: "app.js", source: "code-a" },
      { name: "index.html", source: "html-a" },
    ];
    const b = [
      { name: "index.html", source: "html-a" },
      { name: "app.js", source: "code-a" },
    ];
    expect(hashBundleContents(a)).toBe(hashBundleContents(b));
  });

  it("changes when any file content changes", () => {
    const before = hashBundleContents([
      { name: "app.js", source: "code-a" },
    ]);
    const after = hashBundleContents([
      { name: "app.js", source: "code-b" },
    ]);
    expect(after).not.toBe(before);
  });
});

describe("collectBundleFiles", () => {
  it("lists every file under a dir, relative and sorted", () => {
    const dir = mkdtempSync(join(tmpdir(), "pwa-sw-test-"));
    try {
      writeFileSync(join(dir, "index.html"), "<html/>");
      mkdirSync(join(dir, "assets"));
      writeFileSync(join(dir, "assets", "app-abc.js"), "code");
      writeFileSync(join(dir, "b.txt"), "b");
      expect(collectBundleFiles(dir)).toEqual([
        "assets/app-abc.js",
        "b.txt",
        "index.html",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("buildSwSource", () => {
  const source = buildSwSource("abc123def456", [
    "./app.js",
    "./index.html",
  ]);

  it("embeds the version and the precache list", () => {
    expect(source).toContain('const VERSION = "abc123def456"');
    expect(source).toContain('"./app.js"');
    expect(source).toContain('"./index.html"');
    expect(source).not.toContain("__VERSION__");
  });

  it("takes over promptly and cleans up old caches", () => {
    expect(source).toContain("self.skipWaiting()");
    expect(source).toContain("self.clients.claim()");
    expect(source).toContain("caches.delete(key)");
  });

  it("never caches API calls and falls back to the app shell offline", () => {
    expect(source).toContain('if (url.pathname.indexOf("/api/") === 0) return;');
    expect(source).toContain('caches.match("./index.html")');
  });
});
