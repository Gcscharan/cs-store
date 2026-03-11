"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUpiId = exports.upiVerificationRateLimit = void 0;
const logger_1 = require("../../../utils/logger");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const maskUpiVpa_1 = require("../../../utils/maskUpiVpa");
// Rate limiting for UPI verification (10 requests per minute per IP)
exports.upiVerificationRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute (increased for better UX)
    message: {
        success: false,
        message: "Too many UPI verification attempts. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
/**
 * Verify UPI ID using Razorpay VPA validation API
 * POST /api/payment/verify-upi
 */
const verifyUpiId = async (req, res) => {
    try {
        const { vpa } = req.body;
        // Validate input
        if (!vpa || typeof vpa !== "string" || vpa.trim().length === 0) {
            res.status(400).json({
                success: false,
                message: "UPI ID required",
            });
            return;
        }
        // Basic UPI ID format validation
        const trimmedVpa = vpa.trim();
        if (!trimmedVpa.includes("@") || trimmedVpa.length < 5) {
            res.status(400).json({
                success: false,
                message: "Invalid UPI ID format",
            });
            return;
        }
        // Get Razorpay credentials from environment
        const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
        const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!razorpayKeyId || !razorpaySecret) {
            logger_1.logger.error("Razorpay credentials not configured");
            res.status(500).json({
                success: false,
                message: "Server error",
            });
            return;
        }
        // Create Basic Auth header
        const credentials = Buffer.from(`${razorpayKeyId}:${razorpaySecret}`).toString("base64");
        // For demonstration purposes, using mock data
        // In production, uncomment the Razorpay API call below
        // Mock UPI verification for demonstration
        const mockUpiData = {
            "gcs@okaxis": "GANNAVARAPU SATYA CHARAN",
            "gcs@ybl": "GANNAVARAPU SATYA CHARAN",
            "gcs@paytm": "GANNAVARAPU SATYA CHARAN",
            "gcs@googlepay": "GANNAVARAPU SATYA CHARAN",
            "gcs@phonepe": "GANNAVARAPU SATYA CHARAN",
            "user@okaxis": "John Doe",
            "user@paytm": "Jane Smith",
            "user@googlepay": "Mike Johnson",
            "test@okaxis": "Test User",
            "9059182950@ibl": "Charan Gannavarapu",
            "9059182950@ybl": "Charan Gannavarapu",
            "9059182950@okaxis": "Charan Gannavarapu",
            "9059182950@paytm": "Charan Gannavarapu",
            "9059182950@googlepay": "Charan Gannavarapu",
            "9059182950@phonepe": "Charan Gannavarapu",
        };
        const customer_name = mockUpiData[trimmedVpa];
        const maskedVpa = (0, maskUpiVpa_1.maskUpiVpa)(trimmedVpa);
        if (customer_name) {
            // Log successful verification
            logger_1.logger.info(`UPI verification successful: ${maskedVpa} -> ${customer_name}`);
            res.status(200).json({
                success: true,
                name: customer_name,
            });
            return;
        }
        else {
            // Log failed verification
            logger_1.logger.info(`UPI verification failed: ${maskedVpa} - Not found in mock data`);
            res.status(400).json({
                success: false,
                message: "Invalid UPI ID",
            });
            return;
        }
        /*
        // REAL RAZORPAY API CALL - Uncomment when you have valid credentials
        const razorpayResponse = await axios.post<RazorpayVpaResponse>(
          "https://api.razorpay.com/v1/payments/validate/vpa",
          {
            vpa: trimmedVpa
          },
          {
            headers: {
              "Authorization": `Basic ${credentials}`,
              "Content-Type": "application/json"
            },
            timeout: 5000 // 5 second timeout
          }
        );
    
        const { success, customer_name, error } = razorpayResponse.data;
    
        if (success && customer_name) {
          // Log successful verification
          logger.info(`UPI verification successful: ${maskedVpa} -> ${customer_name}`);
          
          res.status(200).json({
            success: true,
            name: customer_name
          });
          return;
        } else {
          // Log failed verification
          logger.info(`UPI verification failed: ${maskedVpa} - ${error || "Unknown error"}`);
          
          res.status(400).json({
            success: false,
            message: "Invalid UPI ID"
          });
          return;
        }
        */
    }
    catch (error) {
        // Log error with timestamp
        const timestamp = new Date().toISOString();
        const maskedVpa = (0, maskUpiVpa_1.maskUpiVpa)(String(req.body?.vpa || ""));
        logger_1.logger.error(`[${timestamp}] UPI verification error:`, {
            error: error.message,
            vpa: maskedVpa,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });
        // Handle specific error types
        if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
            res.status(500).json({
                success: false,
                message: "UPI verification timeout. Please try again.",
            });
            return;
        }
        if (error.response?.status === 401) {
            logger_1.logger.error("Razorpay authentication failed - check credentials");
            res.status(500).json({
                success: false,
                message: "Server error",
            });
            return;
        }
        if (error.response?.status === 429) {
            res.status(429).json({
                success: false,
                message: "Too many requests to Razorpay. Please try again later.",
            });
            return;
        }
        // Generic error response
        res.status(500).json({
            success: false,
            message: "Server error",
        });
        return;
    }
};
exports.verifyUpiId = verifyUpiId;
