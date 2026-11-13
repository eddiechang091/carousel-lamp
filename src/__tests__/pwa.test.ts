import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "@/lib/pwa";

const mockRegister = vi.fn();

function installServiceWorkerMock() {
  Object.defineProperty(navigator, "serviceWorker", {
    value: { register: mockRegister },
    configurable: true,
  });
}

afterEach(() => {
  mockRegister.mockReset();
  // jsdom has no serviceWorker by default; remove the mock after each test.
  if ("serviceWorker" in navigator) {
    // @ts-expect-error removing the test-only mock property
    delete navigator.serviceWorker;
  }
});

describe("registerServiceWorker", () => {
  it("registers /sw.js when enabled and service workers are supported", async () => {
    installServiceWorkerMock();
    const registration = { scope: "/" };
    mockRegister.mockResolvedValue(registration);

    await expect(
      registerServiceWorker({ enabled: true }),
    ).resolves.toBe(registration);
    expect(mockRegister).toHaveBeenCalledWith("/sw.js");
  });

  it("returns null without registering when disabled", async () => {
    installServiceWorkerMock();

    await expect(
      registerServiceWorker({ enabled: false }),
    ).resolves.toBeNull();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("returns null where service workers are unavailable", async () => {
    await expect(
      registerServiceWorker({ enabled: true }),
    ).resolves.toBeNull();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("returns null instead of throwing when registration fails", async () => {
    installServiceWorkerMock();
    mockRegister.mockRejectedValue(new Error("no sw"));

    await expect(
      registerServiceWorker({ enabled: true }),
    ).resolves.toBeNull();
  });
});
