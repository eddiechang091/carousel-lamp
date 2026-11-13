import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the installability contract: the manifest must carry the fields
// browsers require for install (name, icons 192 + 512, display) and every
// icon it names must exist on disk. Paths resolve from the repo root,
// which is vitest's working directory.
const manifestPath = resolve(process.cwd(), "public/manifest.webmanifest");
const publicDir = resolve(process.cwd(), "public");

interface ManifestIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
}

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
}

describe("PWA manifest", () => {
  it("has the required installability fields", () => {
    const manifest = loadManifest();
    expect(manifest.name).toBe("Carousel Lamp");
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("lists a 192px icon, a 512px icon, and a maskable icon", () => {
    const manifest = loadManifest();
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(
      manifest.icons.some((icon) => icon.purpose === "maskable"),
    ).toBe(true);
  });

  it("names only icon files that exist in public/", () => {
    const manifest = loadManifest();
    for (const icon of manifest.icons) {
      expect(existsSync(join(publicDir, icon.src.replace(/^\//, "")))).toBe(
        true,
      );
    }
  });
});
