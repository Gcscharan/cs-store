import { useState, type JSX } from "react";
import {
  useGetSupportRequestsQuery,
  useResolveSupportRequestMutation,
} from "../../store/api";

type StatusFilter = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ALL";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "ALL", label: "All" },
];

function formatDate(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString("en-IN");
}

export default function SupportInboxPage(): JSX.Element {
  const [filter, setFilter] = useState<StatusFilter>("OPEN");
  const { data, isFetching, error, refetch } = useGetSupportRequestsQuery(
    filter === "ALL" ? { limit: 100 } : { status: filter, limit: 100 }
  );
  const [resolve, { isLoading: resolving }] = useResolveSupportRequestMutation();

  const requests: any[] = data?.requests || [];

  const onResolve = async (id: string, status: "IN_PROGRESS" | "RESOLVED") => {
    const adminNote =
      status === "RESOLVED"
        ? (window.prompt("Resolution note (optional):") || undefined)
        : undefined;
    try {
      await resolve({ id, status, adminNote: adminNote || undefined }).unwrap();
    } catch (e: any) {
      window.alert(String(e?.data?.error || e?.message || "Failed to update request"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-bold text-gray-900">Support Requests</div>
            <div className="mt-1 text-sm text-gray-600">
              Help requests raised by customers and delivery partners.
            </div>
          </div>
          <button
            type="button"
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border ${
                filter === f.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Failed to load support requests.
            </div>
          ) : null}

          {isFetching ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">Loading…</div>
          ) : null}

          {!isFetching && !error && requests.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-700">
              No support requests {filter !== "ALL" ? `with status ${filter}` : ""}.
            </div>
          ) : null}

          <div className="space-y-3">
            {requests.map((r) => {
              const user = r.userId && typeof r.userId === "object" ? r.userId : null;
              return (
                <div key={r._id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                          {String(r.role || "").toUpperCase()}
                        </span>
                        <span className="text-sm font-bold text-gray-900">{r.subject || r.category}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            r.status === "RESOLVED"
                              ? "bg-green-100 text-green-700"
                              : r.status === "IN_PROGRESS"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">Category: {r.category}</div>
                      <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{r.message}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        {user ? `${user.name || "User"} · ${user.phone || ""}` : "Unknown user"} · {formatDate(r.createdAt)}
                      </div>
                      {r.adminNote ? (
                        <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700">
                          <span className="font-semibold">Resolution:</span> {r.adminNote}
                        </div>
                      ) : null}
                    </div>

                    {r.status !== "RESOLVED" ? (
                      <div className="flex shrink-0 flex-col gap-2">
                        {r.status === "OPEN" ? (
                          <button
                            type="button"
                            onClick={() => onResolve(String(r._id), "IN_PROGRESS")}
                            disabled={resolving}
                            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                          >
                            Mark In Progress
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onResolve(String(r._id), "RESOLVED")}
                          disabled={resolving}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
