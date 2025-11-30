"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendDeliveryOtpEmail = void 0;
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY || "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx");
const sendDeliveryOtpEmail = async (email, otp, orderId) => {
    const isDevelopment = process.env.NODE_ENV === "development";
    // Console fallback for development
    if (isDevelopment) {
        console.log("=".repeat(80));
        console.log("📧 DELIVERY OTP EMAIL SENT (CONSOLE MODE)");
        console.log("=".repeat(80));
        console.log(`📧 To: ${email}`);
        console.log(`📦 Order ID: ${orderId}`);
        console.log(`🔑 OTP: ${otp}`);
        console.log(`⏰ Valid for: 10 minutes`);
        console.log(`📅 Time: ${new Date().toLocaleString()}`);
        console.log("=".repeat(80));
        console.log("✅ Share this OTP with your delivery person for order verification");
        console.log("=".repeat(80));
        return;
    }
    try {
        // Try Resend API for production
        const { data, error } = await resend.emails.send({
            from: "CS Store <onboarding@resend.dev>",
            to: [email],
            subject: `Delivery Verification OTP - Order #${orderId}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🚚 CS Store Delivery</h1>
            <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Order Verification OTP</p>
          </div>
          
          <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
                Your delivery person has arrived with your order!
              </p>
              <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                Order ID: <strong>${orderId}</strong>
              </p>
              <p style="color: #666; font-size: 14px; margin-bottom: 30px;">
                Please share this OTP to verify and complete the delivery:
              </p>
              
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 48px; font-weight: bold; letter-spacing: 10px; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; font-family: 'Courier New', monospace;">
                ${otp}
              </div>
              
              <p style="color: #999; font-size: 12px; margin-top: 20px;">
                ⏰ This OTP is valid for 10 minutes
              </p>
            </div>
            
            <div style="background: #f0f7ff; padding: 20px; border-left: 4px solid #667eea; border-radius: 5px; margin-top: 30px;">
              <p style="color: #333; font-size: 14px; margin: 0 0 10px 0;">
                <strong>🔒 Security Tips:</strong>
              </p>
              <ul style="color: #666; font-size: 13px; margin: 0; padding-left: 20px;">
                <li>Only share this OTP with the verified CS Store delivery person</li>
                <li>Never share OTP via call, SMS, or email to unknown persons</li>
                <li>Verify the delivery person's ID before sharing OTP</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                If you did not request this OTP or didn't order anything, please contact our support immediately.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} CS Store. All rights reserved.
            </p>
          </div>
        </div>
      `,
        });
        if (error) {
            console.error("❌ Resend email error:", error);
            // Fall back to console
            console.log("=".repeat(80));
            console.log("📧 DELIVERY OTP EMAIL (FALLBACK - RESEND FAILED)");
            console.log("=".repeat(80));
            console.log(`📧 To: ${email}`);
            console.log(`📦 Order ID: ${orderId}`);
            console.log(`🔑 OTP: ${otp}`);
            console.log("=".repeat(80));
            return;
        }
        console.log(`✅ Delivery OTP email sent successfully to ${email} via Resend`);
    }
    catch (error) {
        console.error("❌ Error sending delivery OTP email:", error);
        // Fall back to console
        console.log("=".repeat(80));
        console.log("📧 DELIVERY OTP EMAIL (FALLBACK - ERROR)");
        console.log("=".repeat(80));
        console.log(`📧 To: ${email}`);
        console.log(`📦 Order ID: ${orderId}`);
        console.log(`🔑 OTP: ${otp}`);
        console.log("=".repeat(80));
    }
};
exports.sendDeliveryOtpEmail = sendDeliveryOtpEmail;
