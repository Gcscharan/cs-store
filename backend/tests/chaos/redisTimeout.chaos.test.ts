import { withFaults } from "./faultInjection";

import redisClient from "../../src/config/redis";

describe("Chaos: Redis timeout", () => {
  test("Redis operations should tolerate timeouts (simulated) without crashing test runner", async () => {
    await withFaults({ redisTimeoutMs: 200 }, async () => {
      const start = Date.now();
      await expect(redisClient.get("k")).resolves.toBeNull();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(150);
    });
  });
});
