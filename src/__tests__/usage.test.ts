import { describe, it, expect, beforeEach } from "vitest";
import {
  readUsageEntries,
  recordUsage,
  clearUsageEntries,
  USAGE_STORAGE_KEY,
  MAX_USAGE_ENTRIES,
  type UsageEntry,
} from "@/services/otari/usage";

const entry = (t: number, tokens = 15): UsageEntry => ({
  t,
  model: "acme/vision-1",
  tokens,
});

describe("usage store", () => {
  beforeEach(() => {
    clearUsageEntries();
  });

  it("starts empty and records entries in order", () => {
    expect(readUsageEntries()).toEqual([]);
    recordUsage(entry(1000));
    recordUsage(entry(2000, 42));
    expect(readUsageEntries()).toEqual([entry(1000), entry(2000, 42)]);
  });

  it("caps at 50 entries, dropping the oldest", () => {
    for (let i = 0; i < MAX_USAGE_ENTRIES + 10; i++) recordUsage(entry(i));
    const entries = readUsageEntries();
    expect(entries).toHaveLength(MAX_USAGE_ENTRIES);
    expect(entries[0].t).toBe(10);
    expect(entries[entries.length - 1].t).toBe(MAX_USAGE_ENTRIES + 9);
  });

  it("ignores corrupt or foreign data instead of throwing", () => {
    localStorage.setItem(USAGE_STORAGE_KEY, "not json{");
    expect(readUsageEntries()).toEqual([]);
    localStorage.setItem(
      USAGE_STORAGE_KEY,
      JSON.stringify([{ t: "soon", model: 1 }, entry(5), { nope: true }]),
    );
    expect(readUsageEntries()).toEqual([entry(5)]);
  });

  it("clears the stored history", () => {
    recordUsage(entry(1));
    clearUsageEntries();
    expect(readUsageEntries()).toEqual([]);
    expect(localStorage.getItem(USAGE_STORAGE_KEY)).toBeNull();
  });
});
