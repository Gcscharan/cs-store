import mongoose, { Document, Schema } from "mongoose";

/**
 * NotificationHealthSnapshot — periodic point-in-time health samples.
 *
 * Written by the RecoveryManager sweep (every ~5 min) so operators can see
 * health TRENDS (min/avg/max over 24h, recovery/escalation counts) instead of
 * only a point-in-time snapshot. TTL-pruned after 7 days.
 */

export interface INotificationHealthSnapshot extends Document {
  overall: number;
  status: string;
  outboxScore: number;
  pushScore: number;
  receiptsScore: number;
  redisScore: number;
  outboxBacklog: number;
  recentDeadLetters: number;
  recoveriesRun: number;     // cumulative recoveries since process start
  escalations: number;       // cumulative escalations since process start
  secondsSinceLastSuccess: number | null;
  createdAt: Date;
}

const SnapshotSchema = new Schema<INotificationHealthSnapshot>(
  {
    overall: { type: Number, required: true },
    status: { type: String, required: true },
    outboxScore: { type: Number, default: 0 },
    pushScore: { type: Number, default: 0 },
    receiptsScore: { type: Number, default: 0 },
    redisScore: { type: Number, default: 0 },
    outboxBacklog: { type: Number, default: 0 },
    recentDeadLetters: { type: Number, default: 0 },
    recoveriesRun: { type: Number, default: 0 },
    escalations: { type: Number, default: 0 },
    secondsSinceLastSuccess: { type: Number, default: null },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false, versionKey: false, collection: "notificationhealthsnapshots" }
);

// TTL + range queries: a single ascending index on createdAt serves both the
// 7-day expiry and the windowed history range scans.
SnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const NotificationHealthSnapshot = mongoose.model<INotificationHealthSnapshot>(
  "NotificationHealthSnapshot",
  SnapshotSchema
);

export default NotificationHealthSnapshot;
