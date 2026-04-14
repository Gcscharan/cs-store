/**
 * useOfflineQueueReplay — Delivery Offline Mutation Replay Hook
 *
 * Subscribes to network status. When connectivity is restored (isOnline
 * transitions from false → true), replays queued delivery mutations in
 * FIFO order:
 *
 *   - 2xx response  → remove from queue, update RTK cache from response
 *   - 4xx/5xx       → remove from queue, show error toast (Alert)
 *   - network error → increment retryCount, keep in queue
 *
 * Requirements: 9b.3, 9b.4, 9b.5, 9b.6
 */

import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { deliveryApi } from '../api/deliveryApi';
import { useNetworkStatus } from './delivery/useNetworkStatus';
import { offlineMutationQueue, OfflineQueueEntry } from '../services/offlineMutationQueue';

/**
 * Map of action name → RTK Query mutation endpoint initiator.
 * Each function accepts (dispatch, entry) and returns the unwrapped response.
 * Throws on network error; returns response data on success.
 */
async function replayEntry(
  dispatch: AppDispatch,
  entry: OfflineQueueEntry,
): Promise<{ status: number; data: any }> {
  const { action, orderId, args } = entry;

  switch (action) {
    case 'pickupOrder':
      return dispatch(
        deliveryApi.endpoints.pickupOrder.initiate({ orderId, ...args }),
      ).then(unwrapMutationResult);

    case 'startDelivery':
      return dispatch(
        deliveryApi.endpoints.startDelivery.initiate({ orderId, ...args }),
      ).then(unwrapMutationResult);

    case 'markArrived':
      return dispatch(
        deliveryApi.endpoints.markArrived.initiate({ orderId, ...args }),
      ).then(unwrapMutationResult);

    case 'verifyDeliveryOtp':
      return dispatch(
        deliveryApi.endpoints.verifyDeliveryOtp.initiate({ orderId, ...args }),
      ).then(unwrapMutationResult);

    case 'recordDeliveryAttempt':
      return dispatch(
        deliveryApi.endpoints.recordDeliveryAttempt.initiate({ orderId, ...args }),
      ).then(unwrapMutationResult);

    case 'acceptOrder':
      return dispatch(
        deliveryApi.endpoints.acceptOrder.initiate({ orderId, ...args }),
      ).then(unwrapMutationResult);

    case 'rejectOrder':
      return dispatch(
        deliveryApi.endpoints.rejectOrder.initiate({ orderId, ...args }),
      ).then(unwrapMutationResult);

    default:
      // Unknown action — treat as a permanent failure so it doesn't block the queue
      console.warn('[useOfflineQueueReplay] Unknown action, removing from queue', { action, orderId });
      return { status: 400, data: { error: `Unknown action: ${action}` } };
  }
}

/**
 * Unwrap an RTK Query mutation result into { status, data }.
 * RTK Query mutations return { data } on success or { error } on failure.
 * The error shape from axiosBaseQuery is { status: number, data: any }.
 */
function unwrapMutationResult(result: any): { status: number; data: any } {
  if (result.error) {
    // RTK Query error shape: { status: number, data: any }
    const status = result.error.status ?? 503;
    throw Object.assign(new Error('Mutation failed'), { status, data: result.error.data });
  }
  // Success — status 200 (RTK Query doesn't expose HTTP status on success, treat as 200)
  return { status: 200, data: result.data };
}

/**
 * Determine if an error is a network error (no HTTP response) vs a server error (4xx/5xx).
 */
function isNetworkError(err: any): boolean {
  const status = err?.status ?? err?.response?.status;
  // 503 is used by axiosBaseQuery for network errors (no response)
  // Also treat missing status as network error
  if (!status || status === 503) return true;
  // 4xx/5xx with an actual HTTP response are server errors
  return false;
}

export function useOfflineQueueReplay(): void {
  const dispatch = useDispatch<AppDispatch>();
  const { isOnline } = useNetworkStatus();
  const prevOnlineRef = useRef<boolean>(isOnline);
  const isReplayingRef = useRef<boolean>(false);

  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    const isNowOnline = isOnline;
    prevOnlineRef.current = isOnline;

    // Only trigger replay on false → true transition
    if (!wasOffline || !isNowOnline) return;
    // Prevent concurrent replays
    if (isReplayingRef.current) return;

    const replay = async () => {
      isReplayingRef.current = true;
      try {
        const entries = await offlineMutationQueue.getAll();
        if (entries.length === 0) return;

        // Replay in FIFO order (entries are stored oldest-first)
        for (const entry of entries) {
          try {
            const result = await replayEntry(dispatch, entry);

            if (result.status >= 200 && result.status < 300) {
              // 2xx: success — remove from queue, update cache from response
              await offlineMutationQueue.remove(entry.id);

              if (result.data) {
                // Update RTK Query cache with the response data if it contains order info
                const order = result.data?.order ?? result.data;
                if (order?._id) {
                  dispatch(
                    deliveryApi.util.updateQueryData(
                      'getDeliveryOrders',
                      undefined,
                      (draft: any) => {
                        if (!draft?.orders) return;
                        const idx = draft.orders.findIndex((o: any) => o._id === order._id);
                        if (idx !== -1) {
                          draft.orders[idx] = { ...draft.orders[idx], ...order };
                        }
                      },
                    ),
                  );
                }
              }
            } else {
              // 4xx/5xx: server error — remove from queue, show toast
              await offlineMutationQueue.remove(entry.id);
              Alert.alert(
                'Action Failed',
                `Could not complete "${entry.action}" for order ${entry.orderId}. Please try again.`,
              );
            }
          } catch (err: any) {
            if (isNetworkError(err)) {
              // Network error — keep in queue, increment retryCount
              await offlineMutationQueue.incrementRetry(entry.id);
            } else {
              // Server error (4xx/5xx thrown) — remove from queue, show toast
              await offlineMutationQueue.remove(entry.id);
              const message =
                err?.data?.error ??
                err?.data?.message ??
                err?.message ??
                `Could not complete "${entry.action}"`;
              Alert.alert('Action Failed', message);
            }
          }
        }
      } finally {
        isReplayingRef.current = false;
      }
    };

    replay().catch((err) => {
      console.error('[useOfflineQueueReplay] Unexpected replay error', err);
      isReplayingRef.current = false;
    });
  }, [isOnline, dispatch]);
}
