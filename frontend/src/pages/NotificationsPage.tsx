import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronDown, ChevronUp, Check } from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RootState } from "../store";

import {
  useGetNotificationsV2Query,
  useLazyGetNotificationsV2Query,
  useGetUnreadNotificationCountQuery,
  useMarkAllAsReadMutation,
  useMarkAsReadMutation,
  useDeleteNotificationMutation,
} from "../store/api";

import { formatNotificationCopy } from "../utils/notificationFormatter";

type NotificationCategory = "order" | "delivery" | "payment" | "account" | "promo";
type NotificationPriority = "high" | "normal" | "low";

type NotificationDTO = {
  id: string;
  title: string;
  body: string;
  eventType?: string;
  meta?: Record<string, any>;
  category: NotificationCategory;
  priority: NotificationPriority;
  isRead: boolean;
  deepLink?: string;
  createdAt: string;
};

type NotificationsV2Response = {
  notifications: NotificationDTO[];
  hasMore: boolean;
  nextCursor?: string;
};

type CategoryFilter = "all" | NotificationCategory;

const CATEGORY_FILTERS: Array<{ key: CategoryFilter; label: string; param?: NotificationCategory }> = [
  { key: "all", label: "All" },
  { key: "order", label: "Orders", param: "order" },
  { key: "payment", label: "Payments", param: "payment" },
  { key: "delivery", label: "Delivery", param: "delivery" },
  { key: "account", label: "Account", param: "account" },
  { key: "promo", label: "Promotions", param: "promo" },
];

function parseCategoryFromSearchParam(value: string | null): CategoryFilter {
  const v = String(value || "").trim();
  if (!v) return "all";
  if (["order", "delivery", "payment", "account", "promo"].includes(v)) {
    return v as NotificationCategory;
  }
  return "all";
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function groupLabelForISODate(iso: string): "Today" | "Yesterday" | "Earlier" {
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return "Earlier";

  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);

  if (dt >= todayStart) return "Today";
  if (dt >= yesterdayStart) return "Yesterday";
  return "Earlier";
}

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const selectedCategory = useMemo(
    () => parseCategoryFromSearchParam(searchParams.get("category")),
    [searchParams]
  );

  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [loadMoreError, setLoadMoreError] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isTabVisible, setIsTabVisible] = useState<boolean>(() => {
    try {
      return typeof document !== "undefined" && document.visibilityState === "visible";
    } catch {
      return true;
    }
  });
  const [pollPausedByError, setPollPausedByError] = useState<boolean>(false);

  const [fetchNotifications] = useLazyGetNotificationsV2Query();

  const pollingEnabled =
    isAuthenticated &&
    isTabVisible &&
    !pollPausedByError &&
    !initialLoading &&
    !initialError;

  const {
    data: polledData,
    error: pollError,
    refetch: refetchPoll,
  } = useGetNotificationsV2Query(
    {
      limit: 20,
      ...(selectedCategory !== "all" ? { category: selectedCategory } : {}),
    },
    {
      skip: !pollingEnabled,
      pollingInterval: 30000,
      refetchOnReconnect: true,
      refetchOnFocus: false,
    }
  );

  const { data: unreadCountData } = useGetUnreadNotificationCountQuery(undefined, {
    skip: !isAuthenticated,
  });
  const unreadCount = Number((unreadCountData as any)?.count || 0);
  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead] = useMarkAllAsReadMutation();
  const [deleteNotification] = useDeleteNotificationMutation();
  
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!pollError) return;
    setPollPausedByError(true);
  }, [pollError]);

  useEffect(() => {
    if (!polledData || !Array.isArray((polledData as any).notifications)) return;
    const incoming = (polledData as any).notifications as NotificationDTO[];
    if (!incoming.length) return;

    const existingIds = new Set(items.map((n) => n.id));
    const newOnes = incoming.filter((n) => !existingIds.has(n.id));
    if (!newOnes.length) return;

    const prevScrollHeight = document.documentElement.scrollHeight;
    const prevScrollY = window.scrollY;

    setItems((prev) => {
      const seen = new Set<string>();
      const combined = [...newOnes, ...prev];
      return combined.filter((n) => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });
    });

    requestAnimationFrame(() => {
      const nextScrollHeight = document.documentElement.scrollHeight;
      const delta = nextScrollHeight - prevScrollHeight;
      if (delta > 0) {
        window.scrollTo(0, prevScrollY + delta);
      }
    });
  }, [items, polledData]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Login Required
            </h2>
            <p className="text-gray-600 mb-6">
              Please log in to access your notifications.
            </p>
          </div>
          <a
            href="/login"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  const mergeUnique = useCallback((existing: NotificationDTO[], incoming: NotificationDTO[]) => {
    const map = new Map<string, NotificationDTO>();
    for (const n of existing) map.set(n.id, n);
    for (const n of incoming) map.set(n.id, n);
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, []);

  const fetchFirstPage = useCallback(async () => {
    setInitialLoading(true);
    setInitialError(false);
    setLoadMoreError(false);
    setExpandedId(null);
    setItems([]);
    setHasMore(false);
    setNextCursor(undefined);
    try {
      const data = (await fetchNotifications({
        limit: 20,
        ...(selectedCategory !== "all" ? { category: selectedCategory } : {}),
      }).unwrap()) as NotificationsV2Response;
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setHasMore(Boolean(data.hasMore));
      setNextCursor(data.nextCursor);
    } catch {
      setInitialError(true);
    } finally {
      setInitialLoading(false);
    }
  }, [fetchNotifications, selectedCategory]);

  const fetchNextPage = useCallback(async () => {
    if (!hasMore) return;
    if (!nextCursor) return;
    if (loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const data = (await fetchNotifications({
        cursor: nextCursor,
        limit: 20,
        ...(selectedCategory !== "all" ? { category: selectedCategory } : {}),
      }).unwrap()) as NotificationsV2Response;
      setItems((prev) => mergeUnique(prev, Array.isArray(data.notifications) ? data.notifications : []));
      setHasMore(Boolean(data.hasMore));
      setNextCursor(data.nextCursor);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchNotifications, hasMore, loadingMore, mergeUnique, nextCursor, selectedCategory]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchFirstPage();
  }, [fetchFirstPage, isAuthenticated]);

  const hasUnread = unreadCount > 0;

  // ✅ UX: Auto mark all as read on page visit to reset bell badge
  useEffect(() => {
    if (!isAuthenticated || !hasUnread) return;
    // Fire-and-forget: mark all as read and invalidate caches
    markAllAsRead(undefined)
      .unwrap()
      .catch(() => {
        // Keep UI stable; backend is source of truth
      });
  }, [isAuthenticated, hasUnread, markAllAsRead]);

  const handleCategoryChange = useCallback(
    (category: CategoryFilter) => {
      const next = new URLSearchParams(searchParams);
      if (category === "all") {
        next.delete("category");
      } else {
        next.set("category", category);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage]);

  const grouped = useMemo(() => {
    const buckets: Record<"Today" | "Yesterday" | "Earlier", NotificationDTO[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    for (const n of items) {
      const key = groupLabelForISODate(n.createdAt);
      buckets[key].push(n);
    }

    const priorityWeight = (p: NotificationPriority): number => {
      if (p === "high") return 0;
      if (p === "normal") return 1;
      return 2;
    };

    for (const key of ["Today", "Yesterday", "Earlier"] as const) {
      buckets[key].sort((a, b) => {
        const pw = priorityWeight(a.priority) - priorityWeight(b.priority);
        if (pw !== 0) return pw;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    return buckets;
  }, [items]);

  const handleCardClick = useCallback(
    async (n: NotificationDTO) => {
      if (!n.isRead) {
        try {
          await markAsRead(n.id).unwrap();
          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
        } catch {
          // keep UI stable; backend is source of truth
        }
      }

      if (n.deepLink) {
        navigate(n.deepLink);
        return;
      }

      setExpandedId((prev) => (prev === n.id ? null : n.id));
    },
    [markAsRead, navigate]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (!hasUnread) return;
    try {
      await markAllAsRead(undefined).unwrap();
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    } catch {
      // keep UI stable
    }
  }, [hasUnread, markAllAsRead]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteNotification(id).unwrap();
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (error) {
      console.error(error);
    }
  }, [deleteNotification]);

  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Back Navigation */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white py-4 px-4 shadow-sm sticky top-0 z-10"
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/account")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back to account"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
              <p className="text-sm text-gray-600">Your updates in one place</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Content area */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-sm p-6"
        >
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
            <button
              onClick={handleMarkAllAsRead}
              disabled={!hasUnread}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                hasUnread
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <Check className="h-4 w-4" />
              Mark all as read
            </button>
          </div>

          <div className="mb-6 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              {CATEGORY_FILTERS.map((f) => {
                const isActive = selectedCategory === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => handleCategoryChange(f.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                    aria-pressed={isActive}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {pollPausedByError && (
            <div className="mb-6 border border-amber-200 bg-amber-50 rounded-lg p-3 flex items-center justify-between gap-3">
              <p className="text-sm text-amber-900">Live updates paused due to a network error.</p>
              <button
                onClick={() => {
                  setPollPausedByError(false);
                  refetchPoll();
                }}
                className="text-sm font-medium text-amber-900 hover:text-amber-950 underline"
              >
                Retry
              </button>
            </div>
          )}

          {initialLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-500 mt-2">Loading notifications...</p>
            </div>
          ) : initialError ? (
            <div className="border border-red-200 bg-red-50 rounded-lg p-4">
              <p className="text-red-800 font-medium">We couldn’t load your notifications.</p>
              <button
                onClick={fetchFirstPage}
                className="mt-3 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold text-gray-900">No new notifications</h3>
              <p className="text-gray-600 mt-2">
                We’ll let you know when there’s an update about your orders, payments, or account.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {(["Today", "Yesterday", "Earlier"] as const).map((section) => {
                const sectionItems = grouped[section];
                if (!sectionItems.length) return null;
                return (
                  <div key={section}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">{section}</h3>
                    <div className="space-y-3">
                      {sectionItems.map((n) => {
                        const isExpanded = expandedId === n.id;
                        const isHigh = n.priority === "high";
                        const formatted = formatNotificationCopy({
                          eventType: (n as any).eventType,
                          meta: (n as any).meta,
                          fallbackTitle: n.title,
                          fallbackBody: n.body,
                        });
                        return (
                          <div
                            key={n.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => void handleCardClick(n)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                void handleCardClick(n);
                              }
                            }}
                            className={`border rounded-lg p-4 transition-colors cursor-pointer ${
                              n.isRead ? "bg-white border-gray-200" : "bg-blue-50 border-blue-200"
                            } ${isHigh ? "ring-1 ring-blue-200" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  {!n.isRead && (
                                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
                                  )}
                                  <p className={`text-sm ${n.isRead ? "font-medium" : "font-semibold"} text-gray-900`}> 
                                    {formatted.title}
                                  </p>
                                  {isHigh && (
                                    <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                      Important
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 mt-1 line-clamp-2">{formatted.body}</p>
                                <p className="text-xs text-gray-500 mt-2">
                                  {new Date(n.createdAt).toLocaleString()}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                {!n.deepLink && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedId((prev) => (prev === n.id ? null : n.id));
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    aria-label={isExpanded ? "Collapse" : "Expand"}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4 text-gray-600" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-gray-600" />
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDelete(n.id);
                                  }}
                                  className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            {!n.deepLink && isExpanded && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{formatted.body}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="pt-2">
                {loadingMore ? (
                  <p className="text-sm text-gray-500">Loading more…</p>
                ) : loadMoreError ? (
                  <button
                    onClick={() => void fetchNextPage()}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Retry loading more
                  </button>
                ) : !hasMore ? (
                  <p className="text-sm text-gray-500">No more notifications</p>
                ) : null}
                <div ref={sentinelRef} />
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default NotificationsPage;
