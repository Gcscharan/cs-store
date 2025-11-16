// SMS utility functions for OTP generation and sending

// Generate 6-digit OTP
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send SMS using Twilio
export const sendSMS = async (
  phone: string,
  message: string
): Promise<boolean> => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    const credsPresent = !!accountSid && !!authToken && !!twilioPhoneNumber;
    if (!credsPresent) {
      console.error(
        "Twilio credentials missing: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER not set"
      );
      console.error("SMS not sent. Ensure environment variables are configured.", {
        TWILIO_ACCOUNT_SID_present: !!accountSid,
        TWILIO_AUTH_TOKEN_present: !!authToken,
        TWILIO_PHONE_NUMBER_present: !!twilioPhoneNumber,
      });
      // Do NOT claim success when creds are missing
      return false;
    }

    // Import Twilio dynamically to avoid issues if not installed
    const twilio = require("twilio");
    const client = twilio(accountSid, authToken);

    const formattedTo = `+91${phone.replace(/\D/g, "")}`; // normalize to E.164 for India

    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: formattedTo,
    });

    console.log(`📱 SMS sent to ${formattedTo}: ${message}`);
    console.log(`📱 Twilio SID: ${result.sid}`);

    return true;
  } catch (error: any) {
    // Capture common Twilio/NW errors
    const details = {
      name: error?.name,
      code: error?.code,
      status: error?.status,
      message: error?.message,
      stack: error?.stack?.split("\n").slice(0, 3).join(" | ") || undefined,
    };
    console.error("❌ SMS sending failed:", details);
    // Do NOT return true on failure; surface it to caller
    return false;
  }
};

// Validate phone number format
export const validatePhoneNumber = (phone: string): boolean => {
  // Basic Indian phone number validation
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ""));
};

// Format phone number for SMS
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  return phone;
};
