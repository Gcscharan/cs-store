import { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { maskUpiVpa } from "../../../utils/maskUpiVpa";
import { verifyVpaWithProvider } from "../services/upiVerificationProvider";

type VerifyUpiRequestBody = {
  vpa: string;
};

type VerifyUpiResponseBody = { valid: boolean; name?: string; bank?: string };

export const upiVerifyRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = String((req as any).user?._id || "anon");
    return `${req.ip}:${userId}`;
  },
  message: { valid: false },
});

const upiVpaRegex = /^[a-z0-9._-]{2,}@[a-z0-9._-]{2,}$/;

export async function verifyUpi(
  req: Request<{}, VerifyUpiResponseBody, VerifyUpiRequestBody>,
  res: Response<VerifyUpiResponseBody>
): Promise<void> {
  const raw = String(req.body?.vpa || "");
  const normalized = raw.trim().toLowerCase();
  const masked = maskUpiVpa(normalized);

  if (!normalized || !upiVpaRegex.test(normalized)) {
    res.status(200).json({ valid: false });
    return;
  }

  try {
    const result = await verifyVpaWithProvider(normalized);

    if (result.valid) {
      res.status(200).json({ valid: true, name: result.name, bank: result.bank });
      return;
    }

    res.status(200).json({ valid: false });
    return;
  } catch (err: any) {
    console.error("[upi-verify] provider_error", {
      vpa: masked,
      message: String(err?.message || ""),
    });
    res.status(200).json({ valid: false });
    return;
  }
}
