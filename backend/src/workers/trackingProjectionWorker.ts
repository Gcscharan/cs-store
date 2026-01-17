import { connectDB } from "../utils/database";
import { startTrackingProjectionWorker } from "../domains/tracking/workers/trackingProjectionWorker";

async function main() {
  await connectDB();
  await startTrackingProjectionWorker();
  // Keep process alive
  // eslint-disable-next-line no-empty
  await new Promise(() => {});
}

void main().catch((e) => {
  console.error("Failed to start tracking projection worker", e);
  process.exit(1);
});
