import { EventEmitter } from "events";
import type { LocationSampleV1 } from "./locationSampleV1";

export type TrackingStreamMessage<T> = {
  key: string;
  value: T;
  receivedAt: string;
};

export type TrackingStreamHandler<T> = (msg: TrackingStreamMessage<T>) => Promise<void>;

export type TrackingStreamSubscription = {
  stop: () => Promise<void>;
};

export interface TrackingEventStream {
  publishLocationSampleV1: (sample: LocationSampleV1) => Promise<void>;
  subscribeLocationSampleV1: (handler: TrackingStreamHandler<LocationSampleV1>) => Promise<TrackingStreamSubscription>;
  publishDlq: (params: { reason: string; raw: any; receivedAt: string }) => Promise<void>;
}

let inMemoryBus:
  | {
      emitter: EventEmitter;
    }
  | undefined;

function getInMemoryBus(): EventEmitter {
  const g = globalThis as any;
  if (g.__trackingInMemoryBus && g.__trackingInMemoryBus instanceof EventEmitter) {
    return g.__trackingInMemoryBus as EventEmitter;
  }
  if (!inMemoryBus) {
    inMemoryBus = { emitter: new EventEmitter() };
    inMemoryBus.emitter.setMaxListeners(50);
  }
  g.__trackingInMemoryBus = inMemoryBus.emitter;
  return inMemoryBus.emitter;
}

function createInMemoryTrackingEventStream(): TrackingEventStream {
  const bus = getInMemoryBus();

  return {
    async publishLocationSampleV1(sample) {
      const msg: TrackingStreamMessage<LocationSampleV1> = {
        key: sample.riderId,
        value: sample,
        receivedAt: new Date().toISOString(),
      };
      bus.emit("tracking.location_sample.v1", msg);
    },

    async subscribeLocationSampleV1(handler) {
      const fn = (msg: TrackingStreamMessage<LocationSampleV1>) => {
        void handler(msg).catch(() => undefined);
      };
      bus.on("tracking.location_sample.v1", fn);
      return {
        stop: async () => {
          bus.off("tracking.location_sample.v1", fn);
        },
      };
    },

    async publishDlq(params) {
      bus.emit("tracking.location_sample.v1.dlq", params);
    },
  };
}

function createKafkaTrackingEventStream(): TrackingEventStream {
  const loadKafka = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require("kafkajs") as any;
    } catch {
      throw new Error("Kafka stream driver requested but kafkajs is not installed");
    }
  };

  const brokers = String(process.env.TRACKING_KAFKA_BROKERS || "").split(",").filter(Boolean);
  const clientId = String(process.env.TRACKING_KAFKA_CLIENT_ID || "tracking-service");
  const groupId = String(process.env.TRACKING_KAFKA_GROUP_ID || "tracking-projection-v1");
  const topic = String(process.env.TRACKING_KAFKA_TOPIC || "tracking.location.samples.v1");
  const dlqTopic = String(process.env.TRACKING_KAFKA_DLQ_TOPIC || "tracking.location.samples.v1.dlq");

  const { Kafka } = loadKafka();
  const kafka = new Kafka({ clientId, brokers });
  const producer = kafka.producer();
  const consumer = kafka.consumer({ groupId });

  let producerConnected = false;
  let consumerConnected = false;

  return {
    async publishLocationSampleV1(sample) {
      if (!producerConnected) {
        await producer.connect();
        producerConnected = true;
      }
      await producer.send({
        topic,
        messages: [{ key: sample.riderId, value: JSON.stringify(sample) }],
      });
    },

    async subscribeLocationSampleV1(handler) {
      if (!consumerConnected) {
        await consumer.connect();
        consumerConnected = true;
      }
      await consumer.subscribe({ topic, fromBeginning: false });

      await consumer.run({
        autoCommit: true,
        eachMessage: async ({ message }: any) => {
          const raw = message?.value ? String(message.value) : "";
          let parsed: any;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = null;
          }

          if (!parsed) {
            await this.publishDlq({ reason: "invalid_json", raw, receivedAt: new Date().toISOString() });
            return;
          }

          const msg: TrackingStreamMessage<LocationSampleV1> = {
            key: String(message?.key ? message.key.toString() : ""),
            value: parsed as LocationSampleV1,
            receivedAt: new Date().toISOString(),
          };

          await handler(msg);
        },
      });

      return {
        stop: async () => {
          await consumer.disconnect().catch(() => undefined);
        },
      };
    },

    async publishDlq(params) {
      if (!producerConnected) {
        await producer.connect();
        producerConnected = true;
      }
      await producer.send({
        topic: dlqTopic,
        messages: [{ key: "dlq", value: JSON.stringify(params) }],
      });
    },
  };
}

let singleton: TrackingEventStream | undefined;

export function getTrackingEventStream(): TrackingEventStream {
  if (singleton) return singleton;

  const driver = String(process.env.TRACKING_STREAM_DRIVER || "").toLowerCase();
  if (process.env.NODE_ENV === "test" || driver === "memory" || !driver) {
    singleton = createInMemoryTrackingEventStream();
    return singleton;
  }

  if (driver === "kafka") {
    singleton = createKafkaTrackingEventStream();
    return singleton;
  }

  singleton = createInMemoryTrackingEventStream();
  return singleton;
}

export function __resetTrackingEventStreamForTests(): void {
  const g = globalThis as any;
  if (g.__trackingInMemoryBus) {
    delete g.__trackingInMemoryBus;
  }
  singleton = undefined;
  inMemoryBus = undefined;
}
