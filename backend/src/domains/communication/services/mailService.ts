import * as nodemailer from "nodemailer";

// Standard SMTP transporter configuration using environment variables
const smtpPort = parseInt(process.env.EMAIL_PORT || "587", 10);

const smtpTransporter = nodemailer.createTransport({
	host: process.env.EMAIL_HOST,
	port: smtpPort,
	secure: smtpPort === 465, // true for port 465, false for others
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
	},
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send email using a single SMTP transporter configured via environment variables
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error(
        "[MailService] EMAIL_HOST, EMAIL_USER or EMAIL_PASS is not configured. Skipping actual email send."
      );
      console.log(
        `[MailService] Would send email to ${options.to} with subject "${options.subject}" (missing SMTP config)`
      );
      return;
    }

    // Verify transporter connectivity before sending
    try {
      await smtpTransporter.verify();
    } catch (verifyErr: any) {
      console.error("❌ [MailService] SMTP verify failed:", {
        message: verifyErr?.message,
        code: verifyErr?.code,
        response: verifyErr?.response,
        responseCode: verifyErr?.responseCode,
        host: process.env.EMAIL_HOST,
        port: smtpPort,
        secure: smtpPort === 465,
      });
      throw verifyErr;
    }

    const info = await smtpTransporter.sendMail({
      from: `"CS Store" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(
      `✅ [MailService] Email sent via SMTP to ${options.to} (MessageId: ${info.messageId || "unknown"})`
    );
  } catch (error: any) {
    const details = {
      message: error?.message,
      code: error?.code,
      errno: error?.errno,
      syscall: error?.syscall,
      address: error?.address,
      port: error?.port,
      response: error?.response,
      responseCode: error?.responseCode,
      command: error?.command,
      host: process.env.EMAIL_HOST,
      smtpPort,
      secure: smtpPort === 465,
      user: process.env.EMAIL_USER,
    };

    // Classify common failure causes
    let hint = "Unknown error";
    if (error?.code === "EAUTH" || error?.responseCode === 535) {
      hint = "Authentication failed. Check EMAIL_USER/EMAIL_PASS and provider app-password settings.";
    } else if (error?.code === "ENOTFOUND" || error?.code === "EAI_AGAIN") {
      hint = "SMTP host not found or DNS issue. Verify EMAIL_HOST.";
    } else if (error?.code === "ETIMEDOUT" || error?.code === "ECONNREFUSED") {
      hint = "Connection timed out/refused. Check network/firewall and port settings.";
    } else if (error?.responseCode === 454 || error?.responseCode === 530) {
      hint = "SMTP requires TLS or authentication. Adjust secure/port or enable less secure/app passwords.";
    }

    console.error("❌ [MailService] Email send failed:", details);
    console.error("ℹ️  [MailService] Hint:", hint);
    console.log(`⚠️  [MailService] Email could not be delivered to ${options.to}`);
  }
};

/**
 * Send OTP email to user
 */
export const sendOTPEmail = async (email: string, otp: string): Promise<void> => {
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

  console.log(`📧 Sending OTP email to: ${email}`);
  console.log(`🔑 OTP: ${otp} (valid for 10 minutes)`);

  await sendEmail({
    to: email,
    subject: "Your CS Store OTP - Login Verification",
    html: htmlContent,
  });
};

/**
 * Send welcome email to new user
 */
export const sendWelcomeEmail = async (email: string, name: string): Promise<void> => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to CS Store!</h1>
      </div>
      
      <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-bottom: 20px;">Hello ${name}!</h2>
        
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          Thank you for joining CS Store. We're excited to have you on board!
        </p>
        
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          Start exploring our wide range of products and enjoy a seamless shopping experience.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Start Shopping
          </a>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            Best regards,<br>
            <strong>CS Store Team</strong>
          </p>
        </div>
      </div>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: "Welcome to CS Store!",
    html: htmlContent,
  });
};
