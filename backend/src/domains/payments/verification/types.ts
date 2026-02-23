export type RazorpayVerifyInput = {
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
};

export interface RazorpayVerificationResult {
  gateway: "RAZORPAY";

  order?: {
    id: string;
    amount: number;
    currency: string;
    status: "created" | "paid" | "attempted";
    attempts: number;
  };

  payment?: {
    id: string;
    status: "authorized" | "captured" | "failed" | "refunded";
    method: string;
    amount: number;
    createdAt: Date;
  };

  refunds?: Array<{
    id: string;
    amount: number;
    status: "processed" | "pending";
  }>;

  fetchedAt: Date;
}

export type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  status: "created" | "paid" | "attempted" | string;
  attempts?: number;
};

export type RazorpayPaymentResponse = {
  id: string;
  status: "authorized" | "captured" | "failed" | "refunded" | string;
  method?: string;
  amount: number;
  created_at?: number;
  order_id?: string;
};

export type RazorpayRefundResponse = {
  id: string;
  amount: number;
  status: "processed" | "pending" | string;
};

export type RazorpayListResponse<T> = {
  items?: T[];
};
