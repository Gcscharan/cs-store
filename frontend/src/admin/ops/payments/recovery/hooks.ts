import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../store";

import { internalGetJson, internalPostJson } from "./internalApi";
import type {
  PaymentsReconciliationItem,
  PaymentVerificationResponse,
  RecoverySuggestionResponse,
  PaymentsRecoveryRowEnrichment,
  RecoveryExecuteAction,
  RecoveryExecuteResponse,
} from "./types";

export type UsePaymentsRecoveryState = {
  items: PaymentsReconciliationItem[];
  enrichmentsByIntentId: Record<string, PaymentsRecoveryRowEnrichment>;
  loadingList: boolean;
  listError: string | null;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  loadingRowIds: Record<string, boolean>;
  hydrateRow: (paymentIntentId: string, orderId: string) => Promise<void>;
  executeSuggestedAction: (args: {
    paymentIntentId: string;
    orderId: string;
    action: RecoveryExecuteAction;
    reason: string;
    confirm: "YES_I_UNDERSTAND_THIS_CHANGES_STATE";
  }) => Promise<{ auditId: string; previousStatus: string; newStatus: string }>;
};

function asIsoStrings(items: any[]): PaymentsReconciliationItem[] {
  return (items || []).map((i) => ({
    ...i,
    createdAt: i?.createdAt ? new Date(i.createdAt).toISOString() : "",
    updatedAt: i?.updatedAt ? new Date(i.updatedAt).toISOString() : "",
    lastScannedAt: i?.lastScannedAt ? new Date(i.lastScannedAt).toISOString() : undefined,
  }));
}

export function usePaymentsRecovery(args?: { pageSize?: number }): UsePaymentsRecoveryState {
  const accessToken = useSelector((s: RootState) => s.auth.tokens?.accessToken);
  const pageSize = args?.pageSize ?? 50;

  const abortRef = useRef<AbortController | null>(null);

  const [items, setItems] = useState<PaymentsReconciliationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);

  const [enrichmentsByIntentId, setEnrichmentsByIntentId] = useState<
    Record<string, PaymentsRecoveryRowEnrichment>
  >({});
  const [loadingRowIds, setLoadingRowIds] = useState<Record<string, boolean>>({});

  const hasMore = useMemo(() => !!nextCursor, [nextCursor]);

  const fetchPage = useCallback(
    async (cursor?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await internalGetJson<PaymentsReconciliationItem[]>({
        pathname: "/internal/payments/reconciliation",
        params: {
          gateway: "RAZORPAY",
          limit: pageSize,
          cursor,
        },
        accessToken,
        signal: controller.signal,
      });

      return {
        items: asIsoStrings(res.data as any),
        nextCursor: res.nextCursor,
      };
    },
    [accessToken, pageSize]
  );

  const refresh = useCallback(() => {
    setLoadingList(true);
    setListError(null);

    fetchPage(undefined)
      .then((p) => {
        setItems(p.items);
        setNextCursor(p.nextCursor);
      })
      .catch((e: any) => {
        setListError(String(e?.message || "Failed"));
      })
      .finally(() => {
        setLoadingList(false);
      });
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setListError(null);

    fetchPage(nextCursor)
      .then((p) => {
        setItems((prev) => {
          const seen = new Set(prev.map((x) => x.paymentIntentId));
          const merged = [...prev];
          for (const it of p.items) {
            if (!seen.has(it.paymentIntentId)) merged.push(it);
          }
          return merged;
        });
        setNextCursor(p.nextCursor);
      })
      .catch((e: any) => {
        setListError(String(e?.message || "Failed"));
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [fetchPage, nextCursor]);

  const hydrateRow = useCallback(
    async (paymentIntentId: string, orderId: string) => {
      if (!paymentIntentId || !orderId) return;

      setLoadingRowIds((m) => ({ ...m, [paymentIntentId]: true }));
      try {
        const [verificationResult, suggestionResult] = await Promise.allSettled([
          internalGetJson<PaymentVerificationResponse>({
            pathname: "/internal/payments/verify",
            params: { paymentIntentId },
            accessToken,
          }).then((r) => r.data),
          internalGetJson<RecoverySuggestionResponse>({
            pathname: "/internal/payments/recovery-suggestion",
            params: { paymentIntentId },
            accessToken,
          }).then((r) => r.data),
        ]);

        const verificationRes =
          verificationResult.status === "fulfilled" ? verificationResult.value : undefined;
        const suggestionRes =
          suggestionResult.status === "fulfilled" ? suggestionResult.value : undefined;

        setEnrichmentsByIntentId((prev) => ({
          ...prev,
          [paymentIntentId]: {
            verification: verificationRes
              ? {
                  ...(verificationRes as any),
                  verifiedAt: (verificationRes as any)?.verifiedAt
                    ? new Date((verificationRes as any).verifiedAt).toISOString()
                    : "",
                }
              : undefined,
            suggestion: suggestionRes,
          },
        }));
      } finally {
        setLoadingRowIds((m) => ({ ...m, [paymentIntentId]: false }));
      }
    },
    [accessToken]
  );

  const executeSuggestedAction = useCallback(
    async (args: {
      paymentIntentId: string;
      orderId: string;
      action: RecoveryExecuteAction;
      reason: string;
      confirm: "YES_I_UNDERSTAND_THIS_CHANGES_STATE";
    }) => {
      const paymentIntentId = String(args.paymentIntentId || "").trim();
      const orderId = String(args.orderId || "").trim();
      if (!paymentIntentId) {
        throw new Error("INVALID_INPUT");
      }
      if (!orderId) {
        throw new Error("INVALID_INPUT");
      }

      const res = await internalPostJson<RecoveryExecuteResponse>({
        pathname: `/internal/payments/recovery-execute/${paymentIntentId}`,
        body: {
          action: args.action,
          reason: args.reason,
          confirm: args.confirm,
        },
        accessToken,
      });

      // Update local row status and re-hydrate details (no polling)
      const previousStatus = String((res.data as any)?.previousStatus || "");
      const newStatus = String((res.data as any)?.newStatus || "");

      setItems((prev) =>
        prev.map((it) =>
          it.paymentIntentId === paymentIntentId
            ? { ...it, status: newStatus || it.status, updatedAt: new Date().toISOString() }
            : it
        )
      );

      await Promise.allSettled([hydrateRow(paymentIntentId, orderId) as any]);

      return {
        auditId: String((res.data as any)?.auditId || ""),
        previousStatus,
        newStatus,
      };
    },
    [accessToken, hydrateRow]
  );

  useEffect(() => {
    refresh();
    return () => {
      abortRef.current?.abort();
    };
  }, [refresh]);

  return {
    items,
    enrichmentsByIntentId,
    loadingList,
    listError,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    loadingRowIds,
    hydrateRow,
    executeSuggestedAction,
  };
}
