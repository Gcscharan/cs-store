import { useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';

export interface QueuedAction {
  id: string;
  action: string;       // 'accept' | 'reject' | 'pickup' | 'startDelivery' | 'markArrived' | 'verifyOtp' | 'failDelivery'
  orderId: string;
  targetStatus: string; // the status this action transitions to
  args: unknown[];
  fn: (...args: any[]) => Promise<void>;
  idempotencyKey: string;
  enqueuedAt: number;
}

// Valid transitions map — matches DELIVERY_STEPS flow
export const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:    ['assigned'],
  assigned:   ['picked_up'],
  picked_up:  ['in_transit'],
  in_transit: ['arrived'],
  arrived:    ['delivered', 'failed'],
};

const MAX_QUEUE_SIZE = 10;

export const useActionQueue = () => {
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const queueRef = useRef<QueuedAction[]>([]);

  const enqueue = useCallback((action: QueuedAction) => {
    setQueue(prev => {
      let next = [...prev, action];
      if (next.length > MAX_QUEUE_SIZE) {
        console.warn('[ActionQueue] Max size exceeded, dropping oldest action');
        next = next.slice(next.length - MAX_QUEUE_SIZE);
      }
      queueRef.current = next;
      return next;
    });
  }, []);

  const replayQueue = useCallback(async (fetchOrderStatus: (orderId: string) => Promise<string>) => {
    const pending = [...queueRef.current];
    if (pending.length === 0) return;

    setIsSyncing(true);
    const toRemove: string[] = [];

    for (const item of pending) {
      try {
        // Validate transition before replay
        const currentStatus = await fetchOrderStatus(item.orderId);
        const validNextStatuses = VALID_TRANSITIONS[currentStatus.toLowerCase()] ?? [];

        if (!validNextStatuses.includes(item.targetStatus.toLowerCase())) {
          // Invalid transition — silently discard
          toRemove.push(item.id);
          continue;
        }

        await item.fn(...item.args);
        toRemove.push(item.id);
      } catch (err: any) {
        // Server error (4xx/5xx) — remove and alert
        toRemove.push(item.id);
        Alert.alert('Sync Error', err?.data?.error || err?.message || 'Failed to sync action');
      }
    }

    setQueue(prev => {
      const next = prev.filter(a => !toRemove.includes(a.id));
      queueRef.current = next;
      return next;
    });
    setIsSyncing(false);
  }, []);

  return {
    enqueue,
    replayQueue,
    isSyncing,
    queueLength: queue.length,
  };
};
