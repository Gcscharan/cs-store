import axios from "axios";

describe("Chaos: Network latency", () => {
  test("external HTTP client should handle slow network via timeouts", async () => {
    // Use a non-routable address to force timeout quickly.
    await expect(
      axios.get("http://10.255.255.1", { timeout: 200 })
    ).rejects.toBeDefined();
  });
});
