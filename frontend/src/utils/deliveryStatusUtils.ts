/**
 * Delivery Status Utilities
 * Provides semantic status badges with icons and next-action hints
 */

import { Package, MapPin, Navigation, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { LucideIcon } from "lucide-react";

export interface StatusBadgeConfig {
  icon: LucideIcon;
  label: string;
  nextAction?: string;
  bgColor: string;
  textColor: string;
  iconColor: string;
}

/**
 * Get status badge configuration with icon, label, and next action hint
 */
export const getStatusBadgeConfig = (status: string): StatusBadgeConfig => {
  const normalizedStatus = String(status || "").toLowerCase().trim();

  switch (normalizedStatus) {
    case "created":
    case "pending":
      return {
        icon: Clock,
        label: "Pending",
        nextAction: "Accept or Decline",
        bgColor: "bg-yellow-100",
        textColor: "text-yellow-800",
        iconColor: "text-yellow-600",
      };

    case "assigned":
    case "confirmed":
      return {
        icon: Package,
        label: "Assigned",
        nextAction: "Navigate to Pickup",
        bgColor: "bg-blue-100",
        textColor: "text-blue-800",
        iconColor: "text-blue-600",
      };

    case "packed":
      return {
        icon: Package,
        label: "Packed",
        nextAction: "Start Delivery",
        bgColor: "bg-indigo-100",
        textColor: "text-indigo-800",
        iconColor: "text-indigo-600",
      };

    case "picked_up":
      return {
        icon: Package,
        label: "Picked Up",
        nextAction: "Start Delivery",
        bgColor: "bg-purple-100",
        textColor: "text-purple-800",
        iconColor: "text-purple-600",
      };

    case "in_transit":
    case "out_for_delivery":
      return {
        icon: Navigation,
        label: "In Transit",
        nextAction: "Mark as Arrived",
        bgColor: "bg-orange-100",
        textColor: "text-orange-800",
        iconColor: "text-orange-600",
      };

    case "arrived":
      return {
        icon: MapPin,
        label: "Arrived",
        nextAction: "Complete Delivery",
        bgColor: "bg-green-100",
        textColor: "text-green-800",
        iconColor: "text-green-600",
      };

    case "delivered":
      return {
        icon: CheckCircle,
        label: "Delivered",
        bgColor: "bg-green-100",
        textColor: "text-green-800",
        iconColor: "text-green-600",
      };

    case "cancelled":
      return {
        icon: AlertCircle,
        label: "Cancelled",
        bgColor: "bg-red-100",
        textColor: "text-red-800",
        iconColor: "text-red-600",
      };

    default:
      return {
        icon: Clock,
        label: normalizedStatus.replace("_", " ").toUpperCase() || "Unknown",
        bgColor: "bg-gray-100",
        textColor: "text-gray-800",
        iconColor: "text-gray-600",
      };
  }
};

/**
 * Get unified payment status badge text
 */
export const getPaymentStatusText = (
  paymentMethod: string,
  paymentStatus: string,
  amount: number
): string => {
  const method = String(paymentMethod || "").toUpperCase();
  const status = String(paymentStatus || "").toLowerCase();

  if (status === "paid") {
    return `Payment: ₹${amount.toLocaleString("en-IN")} (${method}) - Received ✅`;
  }

  if (status === "awaiting_upi_approval") {
    return `Payment: ₹${amount.toLocaleString("en-IN")} (${method}) - Awaiting Approval`;
  }

  return `Payment: ₹${amount.toLocaleString("en-IN")} (${method}) - Pending`;
};

/**
 * Get payment status badge color
 */
export const getPaymentStatusColor = (paymentStatus: string): {
  bgColor: string;
  textColor: string;
} => {
  const status = String(paymentStatus || "").toLowerCase();

  if (status === "paid") {
    return {
      bgColor: "bg-green-100",
      textColor: "text-green-800",
    };
  }

  if (status === "awaiting_upi_approval") {
    return {
      bgColor: "bg-yellow-100",
      textColor: "text-yellow-800",
    };
  }

  return {
    bgColor: "bg-gray-100",
    textColor: "text-gray-800",
  };
};
