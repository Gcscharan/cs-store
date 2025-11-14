"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPhoneNumber = exports.validatePhoneNumber = exports.sendSMS = exports.generateOTP = void 0;
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
exports.generateOTP = generateOTP;
const sendSMS = async (phone, message) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
        if (!accountSid || !authToken || !twilioPhoneNumber) {
            console.error("Twilio credentials not configured, falling back to console log");
            console.log(`📱 [FALLBACK] SMS to ${phone}: ${message}`);
            return true;
        }
        const twilio = require("twilio");
        const client = twilio(accountSid, authToken);
        const result = await client.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: `+91${phone}`,
        });
        console.log(`📱 SMS sent to ${phone}: ${message}`);
        console.log(`📱 Twilio SID: ${result.sid}`);
        return true;
    }
    catch (error) {
        console.error("SMS sending failed:", error);
        console.log(`📱 [FALLBACK] SMS to ${phone}: ${message}`);
        return true;
    }
};
exports.sendSMS = sendSMS;
const validatePhoneNumber = (phone) => {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\D/g, ""));
};
exports.validatePhoneNumber = validatePhoneNumber;
const formatPhoneNumber = (phone) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
        return `+91${cleaned}`;
    }
    return phone;
};
exports.formatPhoneNumber = formatPhoneNumber;
//# sourceMappingURL=sms.js.map