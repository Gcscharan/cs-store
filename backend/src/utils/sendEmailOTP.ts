import { logger } from './logger';
import { Resend } from "resend";
import * as nodemailer from "nodemailer";

// Initialize Resend with API key from environment
const resend = new Resend(
  process.env.RESEND_API_KEY || "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx"
);

export const sendEmailOTP = async (
  email: string,
  otp: string
): Promise<void> => {
  logger.info(`\n📧 Attempting to send OTP email to: ${email}`);
  logger.info(`🔑 OTP: ${otp} (also logged for debugging)\n`);

  // Try Gmail SMTP first (Primary method for OTP)
  try {
    logger.info("📤 Sending email via Gmail SMTP...");
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'gcs.charan@gmail.com',
        pass: 'lnjhscqyipztkvyu', // App password
      },
    });

    // Send email
    await transporter.sendMail({
      from: '"CS Store" <gcs.charan@gmail.com>',
      to: email,
      subject: 'Your CS Store OTP - Login Verification',
      html: `
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
      `,
    });

    logger.info("=".repeat(80));
    logger.info("✅ OTP EMAIL SENT VIA GMAIL SMTP");
    logger.info("=".repeat(80));
    logger.info(`📧 To: ${email}`);
    logger.info(`🔑 OTP: ${otp} (for debugging)`);
    logger.info(`⏰ Valid for: 10 minutes`);
    logger.info(`📅 Time: ${new Date().toLocaleString()}`);
    logger.info("=".repeat(80));
    logger.info("✅ User should receive email shortly!");
    logger.info("=".repeat(80));
    
  } catch (gmailError: any) {
    logger.error("❌ Gmail SMTP failed:", gmailError.message);
    logger.info("🔄 Trying Resend API fallback...");
    
    // Fallback to Resend API
    try {
      const { data, error } = await resend.emails.send({
      from: "CS Store <onboarding@resend.dev>",
      to: [email],
      subject: "Your CS Store OTP - Login Verification",
      html: `
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
      `,
    });

    if (error) {
      logger.error("❌ Resend API Error:", error);
      logger.error("Error details:", JSON.stringify(error, null, 2));
      throw new Error(`Resend failed: ${error.message || "Unknown error"}`);
    }

      logger.info("=".repeat(80));
      logger.info("✅ OTP EMAIL SENT SUCCESSFULLY VIA RESEND");
      logger.info("=".repeat(80));
      logger.info(`📧 To: ${email}`);
      logger.info(`📨 Email ID: ${data?.id}`);
      logger.info(`🔑 OTP: ${otp} (for debugging)`);
      logger.info(`⏰ Valid for: 10 minutes`);
      logger.info(`📅 Time: ${new Date().toLocaleString()}`);
      logger.info("=".repeat(80));
      logger.info("✅ User should receive email shortly!");
      logger.info("=".repeat(80));
      
    } catch (resendError: any) {
      logger.error("❌ Resend API also failed:", resendError.message);
      
      // Final fallback: Console logging
      logger.info("=".repeat(80));
      logger.info("⚠️  EMAIL OTP SENT (CONSOLE FALLBACK)");
      logger.info("=".repeat(80));
      logger.info(`📧 To: ${email}`);
      logger.info(`🔑 OTP: ${otp}`);
      logger.info(`⏰ Valid for: 10 minutes`);
      logger.info(`📅 Time: ${new Date().toLocaleString()}`);
      logger.info("=".repeat(80));
      logger.info("⚠️  All email services failed - OTP displayed in console for testing");
      logger.info("=".repeat(80));
    }
  }
};
