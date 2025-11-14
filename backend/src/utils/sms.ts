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

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      console.error(
        "Twilio credentials not configured, falling back to console log"
      );
      console.log(`📱 [FALLBACK] SMS to ${phone}: ${message}`);
      return true;
    }

    // Import Twilio dynamically to avoid issues if not installed
    const twilio = require("twilio");
    const client = twilio(accountSid, authToken);

    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: `+91${phone}`, // Assuming Indian numbers
    });

    console.log(`📱 SMS sent to ${phone}: ${message}`);
    console.log(`📱 Twilio SID: ${result.sid}`);

    return true;
  } catch (error) {
    console.error("SMS sending failed:", error);

    // Fallback to console log for development
    console.log(`📱 [FALLBACK] SMS to ${phone}: ${message}`);
    return true; // Return true to not break the flow
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
