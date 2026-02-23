import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

import {
  RazorpayVerificationError,
  RazorpayVerificationErrorCode,
} from "./errors";
import type {
  RazorpayListResponse,
  RazorpayOrderResponse,
  RazorpayPaymentResponse,
  RazorpayRefundResponse,
} from "./types";

type RequestOpts = {
  signal?: AbortSignal;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err: RazorpayVerificationError): boolean {
  if (err.code === RazorpayVerificationErrorCode.RATE_LIMITED) return false;
  if (err.code === RazorpayVerificationErrorCode.AUTH_FAILED) return false;
  if (err.code === RazorpayVerificationErrorCode.NOT_FOUND) return false;
  if (err.code === RazorpayVerificationErrorCode.INVALID_INPUT) return false;
  return (
    err.code === RazorpayVerificationErrorCode.NETWORK_ERROR ||
    err.code === RazorpayVerificationErrorCode.GATEWAY_TIMEOUT
  );
}

function mapAxiosError(err: any): RazorpayVerificationError {
  const httpStatus = err?.response?.status ? Number(err.response.status) : undefined;

  if (httpStatus === 400) {
    return new RazorpayVerificationError({
      code: RazorpayVerificationErrorCode.INVALID_INPUT,
      httpStatus,
      message: "Invalid input for Razorpay API",
    });
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return new RazorpayVerificationError({
      code: RazorpayVerificationErrorCode.AUTH_FAILED,
      httpStatus,
      message: "Razorpay auth failed",
    });
  }

  if (httpStatus === 404) {
    return new RazorpayVerificationError({
      code: RazorpayVerificationErrorCode.NOT_FOUND,
      httpStatus,
      message: "Razorpay resource not found",
    });
  }

  if (httpStatus === 429) {
    return new RazorpayVerificationError({
      code: RazorpayVerificationErrorCode.RATE_LIMITED,
      httpStatus,
      message: "Razorpay rate limited",
    });
  }

  if (httpStatus === 408 || httpStatus === 504) {
    return new RazorpayVerificationError({
      code: RazorpayVerificationErrorCode.GATEWAY_TIMEOUT,
      httpStatus,
      message: "Razorpay gateway timeout",
    });
  }

  const code = String(err?.code || "").toUpperCase();
  const message = String(err?.message || "");

  if (code === "ECONNABORTED" || message.toLowerCase().includes("timeout")) {
    return new RazorpayVerificationError({
      code: RazorpayVerificationErrorCode.GATEWAY_TIMEOUT,
      message: "Razorpay request timed out",
    });
  }

  if (code === "ENOTFOUND" || code === "ECONNRESET" || code === "EAI_AGAIN") {
    return new RazorpayVerificationError({
      code: RazorpayVerificationErrorCode.NETWORK_ERROR,
      message: "Network error calling Razorpay",
    });
  }

  if (httpStatus && httpStatus >= 500) {
    return new RazorpayVerificationError({
      code: RazorpayVerificationErrorCode.NETWORK_ERROR,
      httpStatus,
      message: "Razorpay upstream error",
    });
  }

  return new RazorpayVerificationError({
    code: RazorpayVerificationErrorCode.NETWORK_ERROR,
    httpStatus,
    message: "Unknown error calling Razorpay",
  });
}

function attachAbort(parent: AbortSignal, child: AbortController) {
  if (parent.aborted) {
    child.abort();
    return;
  }

  const onAbort = () => child.abort();
  parent.addEventListener("abort", onAbort, { once: true });
}

export class RazorpayReadonlyClient {
  private readonly http: AxiosInstance;
  private static readonly maxInFlight: number = 4;
  private static readonly minIntervalMs: number = 100;
  private static inFlight: number = 0;
  private static lastRequestAtMs: number = 0;

  constructor(args?: { baseURL?: string }) {
    const keyId = String(process.env.RAZORPAY_KEY_ID!).trim();
    const keySecret = String(process.env.RAZORPAY_KEY_SECRET!).trim();

    if (!keyId || !keySecret) {
      throw new Error("RazorpayReadonlyClient misconfigured: RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET required");
    }

    this.http = axios.create({
      baseURL: args?.baseURL || "https://api.razorpay.com/v1",
      timeout: 5000,
      auth: { username: keyId, password: keySecret },
    });
  }

  private async acquire(): Promise<void> {
    while (RazorpayReadonlyClient.inFlight >= RazorpayReadonlyClient.maxInFlight) {
      await sleep(25);
    }

    const now = Date.now();
    const nextAllowedAt = RazorpayReadonlyClient.lastRequestAtMs + RazorpayReadonlyClient.minIntervalMs;
    if (now < nextAllowedAt) {
      await sleep(nextAllowedAt - now);
    }

    RazorpayReadonlyClient.lastRequestAtMs = Date.now();
    RazorpayReadonlyClient.inFlight += 1;
  }

  private release() {
    RazorpayReadonlyClient.inFlight = Math.max(0, RazorpayReadonlyClient.inFlight - 1);
  }

  private async get<T>(url: string, opts?: RequestOpts): Promise<T> {
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      if (opts?.signal) attachAbort(opts.signal, controller);

      try {
        await this.acquire();
        const config: AxiosRequestConfig = {
          method: "GET",
          url,
          signal: controller.signal,
        };

        const res = await this.http.request<T>(config);
        return res.data;
      } catch (e: any) {
        const mapped = e instanceof RazorpayVerificationError ? e : mapAxiosError(e);

        if (attempt < maxRetries && isRetryable(mapped)) {
          const backoffMs = 200 * Math.pow(2, attempt);
          await sleep(backoffMs);
          continue;
        }

        throw mapped;
      } finally {
        this.release();
      }
    }

    throw new RazorpayVerificationError({
      code: RazorpayVerificationErrorCode.NETWORK_ERROR,
      message: "Unexpected retry loop exit",
    });
  }

  async fetchOrder(orderId: string, opts?: RequestOpts): Promise<RazorpayOrderResponse> {
    return this.get<RazorpayOrderResponse>(`/orders/${encodeURIComponent(orderId)}`, opts);
  }

  async fetchPayment(paymentId: string, opts?: RequestOpts): Promise<RazorpayPaymentResponse> {
    return this.get<RazorpayPaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`, opts);
  }

  async fetchOrderPayments(orderId: string, opts?: RequestOpts): Promise<RazorpayListResponse<RazorpayPaymentResponse>> {
    return this.get<RazorpayListResponse<RazorpayPaymentResponse>>(
      `/orders/${encodeURIComponent(orderId)}/payments`,
      opts
    );
  }

  async fetchPaymentRefunds(paymentId: string, opts?: RequestOpts): Promise<RazorpayListResponse<RazorpayRefundResponse>> {
    return this.get<RazorpayListResponse<RazorpayRefundResponse>>(
      `/payments/${encodeURIComponent(paymentId)}/refunds`,
      opts
    );
  }
}
