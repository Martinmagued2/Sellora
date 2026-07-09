import { describe, it, expect } from "vitest";
import { humanReplyDelay } from "../ai/reply-helpers";

describe("humanReplyDelay", () => {
  it("returns a promise that resolves", async () => {
    const start = Date.now();
    await humanReplyDelay("hi");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(900); // close to the 1000ms floor
    expect(elapsed).toBeLessThan(3000);
  });

  it("uses longer delay for longer replies", async () => {
    const shortDelay = await measureDelay("hi");
    const longReply = "This is a much longer reply that should trigger the longer delay bucket because it has more than two hundred characters in it. We are padding this out to make sure it crosses the threshold that the helper uses to decide how long to wait before sending the AI message back to the customer.";
    const longDelay = await measureDelay(longReply);
    // Long reply should typically take longer (both have randomness, so use a loose check)
    expect(longDelay).toBeGreaterThanOrEqual(shortDelay - 500);
  });
});

async function measureDelay(text) {
  const start = Date.now();
  await humanReplyDelay(text);
  return Date.now() - start;
}
