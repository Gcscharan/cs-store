export enum RazorpayVerificationErrorCode {
  NOT_FOUND = "NOT_FOUND",
  AUTH_FAILED = "AUTH_FAILED",
  RATE_LIMITED = "RATE_LIMITED",
  NETWORK_ERROR = "NETWORK_ERROR",
  GATEWAY_TIMEOUT = "GATEWAY_TIMEOUT",
  INVALID_INPUT = "INVALID_INPUT",
}

export class RazorpayVerificationError extends Error {
  public readonly code: RazorpayVerificationErrorCode;
  public readonly httpStatus?: number;

  constructor(args: { code: RazorpayVerificationErrorCode; message?: string; httpStatus?: number }) {
    super(args.message || args.code);
    this.name = "RazorpayVerificationError";
    this.code = args.code;
    this.httpStatus = args.httpStatus;
  }
}
