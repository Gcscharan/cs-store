import axios from "axios";

export type UpiVerificationResult =
  | { valid: true; name?: string; bank?: string }
  | { valid: false };

interface RazorpayVpaResponse {
  success: boolean;
  vpa?: string;
  customer_name?: string;
  bank?: string;
  bank_name?: string;
  error?: string;
}

export async function verifyVpaWithProvider(vpa: string): Promise<UpiVerificationResult> {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayKeyId || !razorpaySecret) {
    return { valid: false };
  }

  const credentials = Buffer.from(`${razorpayKeyId}:${razorpaySecret}`).toString("base64");

  let res: { data?: RazorpayVpaResponse } | null = null;
  try {
    res = await axios.post<RazorpayVpaResponse>(
      "https://api.razorpay.com/v1/payments/validate/vpa",
      { vpa },
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );
  } catch (err: any) {
    return { valid: false };
  }

  const { success, customer_name, bank, bank_name } = (res?.data || {}) as any;
  if (success) {
    const name = typeof customer_name === "string" ? customer_name.trim() : "";
    const bankOut = typeof bank_name === "string" ? bank_name.trim() : typeof bank === "string" ? bank.trim() : "";
    return {
      valid: true,
      ...(name ? { name } : {}),
      ...(bankOut ? { bank: bankOut } : {}),
    };
  }

  return { valid: false };
}
