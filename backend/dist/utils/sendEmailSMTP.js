"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailOTP = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
// Create Gmail SMTP transporter
const createTransporter = () => {
    // Force the correct Gmail credentials
    const gmailUser = "gcs.charan@gmail.com";
    const gmailPass = "nwppbjguzdcjdekr"; // Gmail App Password (no spaces)
    console.log("🔧 SMTP Configuration:", {
        user: gmailUser,
        pass: gmailPass.substring(0, 4) + "****", // Hide password in logs
        host: "smtp.gmail.com",
        port: 587,
    });
    return nodemailer_1.default.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: gmailUser,
            pass: gmailPass,
        },
    });
};
const sendEmailOTP = async (email, otp) => {
    try {
        const transporter = createTransporter();
        // Email template
        const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">CS Store</h1>
          <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Your One-Time Password</p>
        </div>
        
        <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px; text-align: center;">Login Verification</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            Hello! You requested a one-time password (OTP) to access your CS Store account.
          </p>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; text-align: center; margin: 30px 0; border: 2px dashed #667eea;">
            <h3 style="color: #333; font-size: 36px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace; font-weight: bold;">${otp}</h3>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center; margin: 20px 0;">
            This OTP is valid for <strong>10 minutes</strong>. If you didn't request this code, please ignore this email.
          </p>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              Best regards,<br>
              <strong>CS Store Team</strong>
            </p>
          </div>
        </div>
      </div>
    `;
        const mailOptions = {
            from: `"CS Store" <gcs.charan@gmail.com>`,
            to: email,
            subject: "Your CS Store OTP - Login Verification",
            html: htmlContent,
        };
        const info = await transporter.sendMail(mailOptions);
        console.log("✅ OTP email sent successfully via Gmail SMTP to", email);
        console.log("📧 Message ID:", info.messageId);
    }
    catch (error) {
        console.error("❌ Gmail SMTP failed:", error);
        // Fallback to console logging
        console.log("=".repeat(80));
        console.log("📧 EMAIL OTP SENT (CONSOLE FALLBACK)");
        console.log("=".repeat(80));
        console.log(`📧 To: ${email}`);
        console.log(`🔑 OTP: ${otp}`);
        console.log(`⏰ Valid for: 10 minutes`);
        console.log(`📅 Time: ${new Date().toLocaleString()}`);
        console.log("=".repeat(80));
        console.log("✅ Use this OTP in your frontend to complete login");
        console.log("=".repeat(80));
        console.log("💡 SMTP configuration needed for real email delivery");
        console.log("=".repeat(80));
    }
};
exports.sendEmailOTP = sendEmailOTP;
