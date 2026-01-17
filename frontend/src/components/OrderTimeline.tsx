import { Check, CircleDot, Hourglass, XCircle } from "lucide-react";
import { formatEta } from "../utils/formatEta";

export type OrderTimelineStep = {
  key: string;
  label: string;
  description?: string;
  timestamp?: string;
  state: "completed" | "current" | "pending" | "failed";
  actor?: "system" | "admin" | "delivery";
  eta?: {
    start: string;
    end: string;
    confidence?: "high" | "medium";
  };
};

function formatTimestamp(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function OrderTimeline(props: { steps: OrderTimelineStep[] }) {
  const steps = Array.isArray(props.steps) ? props.steps : [];

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        const icon =
          step.state === "completed"
            ? Check
            : step.state === "current"
              ? CircleDot
              : step.state === "failed"
                ? XCircle
                : Hourglass;

        const iconWrapClass =
          step.state === "completed"
            ? "bg-green-600 text-white"
            : step.state === "current"
              ? "bg-blue-600 text-white"
              : step.state === "failed"
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-500";

        const lineClass =
          step.state === "completed"
            ? "bg-green-600"
            : step.state === "failed"
              ? "bg-red-600"
              : "bg-gray-300";

        const Icon = icon;
        const ts = step.state === "pending" ? "" : formatTimestamp(step.timestamp);

        return (
          <div key={step.key} className="relative flex items-start">
            <div className="relative flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconWrapClass}`}>
                <Icon className="h-5 w-5" />
              </div>

              {!isLast && <div className={`w-0.5 h-7 mt-1 ${lineClass}`} />}
            </div>

            <div className="ml-4 flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      step.state === "pending" ? "text-gray-500" : "text-gray-900"
                    }`}
                  >
                    {step.label}
                  </p>

                  {step.key === "CUSTOMER_OUT_FOR_DELIVERY" && step.eta && step.state === "current" && (
                    <div className="mt-2 inline-flex items-center rounded-md bg-blue-50 px-3 py-1.5">
                      <p className="text-sm font-semibold text-blue-700">
                        {formatEta(step.eta)}
                      </p>
                    </div>
                  )}

                  {step.description && step.state === "failed" && (
                    <p className="text-sm text-red-700 mt-1">{step.description}</p>
                  )}
                </div>
                {ts ? <p className="text-xs text-gray-500 flex-shrink-0">{ts}</p> : null}
              </div>

              {step.state === "current" && !step.description && (
                <p className="text-xs text-blue-600 mt-0.5">Current status</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
