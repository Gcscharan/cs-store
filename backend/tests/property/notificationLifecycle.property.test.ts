/**
 * Property-based invariants for the notification delivery lifecycle state machine.
 *
 * Lifecycle (per channel): sent → delivered → opened → clicked, with `failed`
 * reachable only pre-delivery. updateLifecycleStatus enforces monotonic
 * progression. These properties assert the reviewer's invariants:
 *
 *   LC-1  FAILED → OPENED can never happen.
 *   LC-2  DELIVERED → SENT (backward) can never happen.
 *   LC-3  Applying an arbitrary sequence of status updates always leaves the
 *         channel at the HIGHEST-rank status it legally reached (never regresses).
 *   LC-4  `failed` never overwrites a delivered/opened/clicked status.
 */

import fc from "fast-check";
import mongoose from "mongoose";

import Notification from "../../src/models/Notification";
import { updateLifecycleStatus, LifecycleStatus } from "../../src/domains/communication/services/deliveryTracker";

const RANK: Record<string, number> = { sent: 1, delivered: 2, opened: 3, clicked: 4 };

async function createNotification(): Promise<string> {
  const doc = await Notification.create({
    userId: new mongoose.Types.ObjectId(),
    title: "t",
    message: "m",
    isRead: false,
  });
  return doc._id.toString();
}

async function getStatus(id: string): Promise<string | undefined> {
  const doc = await Notification.findById(id).lean();
  return (doc as any)?.lifecycle?.push?.status;
}

describe("Property: notification lifecycle state machine", () => {
  beforeEach(async () => {
    await Notification.deleteMany({});
  });

  it("LC-1: a failed notification can never become opened", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        await Notification.deleteMany({});
        const id = await createNotification();

        await updateLifecycleStatus(id, "push", "sent");
        await updateLifecycleStatus(id, "push", "failed", "boom");
        // Attempt illegal forward jump from failed → opened
        await updateLifecycleStatus(id, "push", "opened");

        const status = await getStatus(id);
        expect(status).toBe("failed"); // never advanced to opened
      }),
      { numRuns: 5 }
    );
  });

  it("LC-2: delivered never regresses to sent", async () => {
    const id = await createNotification();
    await updateLifecycleStatus(id, "push", "sent");
    await updateLifecycleStatus(id, "push", "delivered");
    await updateLifecycleStatus(id, "push", "sent"); // illegal backward

    expect(await getStatus(id)).toBe("delivered");
  });

  it("LC-3: arbitrary update sequences never regress the channel status", async () => {
    const statusArb = fc.constantFrom<LifecycleStatus>("sent", "delivered", "opened", "clicked", "failed");

    await fc.assert(
      fc.asyncProperty(fc.array(statusArb, { minLength: 1, maxLength: 12 }), async (sequence) => {
        await Notification.deleteMany({});
        const id = await createNotification();

        let prevRank = 0;
        let prevWasFailed = false;

        for (const s of sequence) {
          await updateLifecycleStatus(id, "push", s);
          const cur = await getStatus(id);
          const curRank = cur === "failed" ? 0 : cur ? RANK[cur] : 0;

          // Core invariant: a successful-progression status never decreases.
          // (failed is a separate terminal branch handled by LC-1/LC-4.)
          if (cur !== "failed" && !prevWasFailed) {
            expect(curRank).toBeGreaterThanOrEqual(prevRank);
          }
          // Once failed, it can never become opened/clicked/delivered.
          if (prevWasFailed) {
            expect(cur).toBe("failed");
          }

          prevRank = cur === "failed" ? prevRank : curRank;
          prevWasFailed = prevWasFailed || cur === "failed";
        }
      }),
      { numRuns: 30 }
    );
  });

  it("LC-4: failed cannot overwrite delivered/opened/clicked", async () => {
    for (const advanced of ["delivered", "opened", "clicked"] as LifecycleStatus[]) {
      await Notification.deleteMany({});
      const id = await createNotification();

      // Walk forward legally to the advanced status.
      await updateLifecycleStatus(id, "push", "sent");
      if (RANK[advanced] >= 2) await updateLifecycleStatus(id, "push", "delivered");
      if (RANK[advanced] >= 3) await updateLifecycleStatus(id, "push", "opened");
      if (RANK[advanced] >= 4) await updateLifecycleStatus(id, "push", "clicked");

      // A late failure must NOT regress it.
      await updateLifecycleStatus(id, "push", "failed", "late failure");

      expect(await getStatus(id)).toBe(advanced);
    }
  });
});
