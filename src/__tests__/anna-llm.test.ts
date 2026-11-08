import { describe, expect, it } from "vitest";
import { getLlmService } from "@/services/anna/llm";

describe("anna llm service", () => {
  it("is unavailable outside the Anna host", async () => {
    const llm = await getLlmService();
    expect(llm.available).toBe(false);
    await expect(
      llm.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toBeInstanceOf(Error);
  });
});
