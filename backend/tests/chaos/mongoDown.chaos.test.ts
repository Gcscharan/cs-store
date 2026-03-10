import mongoose from "mongoose";

describe("Chaos: MongoDB down", () => {
  test("Mongo operations should fail fast and not hang", async () => {
    // Simulate DB down by disconnecting
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    const { User } = await import("../../src/models/User");

    const start = Date.now();
    await expect(User.findOne({ email: "x" }).maxTimeMS(1000)).rejects.toBeDefined();
    const elapsed = Date.now() - start;

    // Ensure it fails quickly (not hanging indefinitely)
    expect(elapsed).toBeLessThan(5000);
  });
});
