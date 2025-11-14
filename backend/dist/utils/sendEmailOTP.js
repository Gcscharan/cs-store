"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailOTP = void 0;
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY || "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx");
const sendEmailOTP = async (email, otp) => {
    const isDevelopment = process.env.NODE_ENV === "development";
    const isUniversityEmail = email === "2203031240398@paruluniversity.ac.in";
    const isTestEmail = email === "gcs.charan@gmail.com";
    if (isDevelopment || isUniversityEmail || !isTestEmail) {
        console.log("=".repeat(80));
        console.log("📧 EMAIL OTP SENT (CONSOLE MODE)");
        console.log("=".repeat(80));
        console.log(`📧 To: ${email}`);
        console.log(`🔑 OTP: ${otp}`);
        console.log(`⏰ Valid for: 10 minutes`);
        console.log(`📅 Time: ${new Date().toLocaleString()}`);
        console.log("=".repeat(80));
        console.log("✅ Use this OTP in your frontend to complete login");
        console.log("=".repeat(80));
        if (isUniversityEmail) {
            console.log("🎓 University email - using console fallback for testing");
        }
        else if (isDevelopment) {
            console.log("💡 Development mode - using console fallback for testing");
        }
        else {
            console.log("💡 Non-test email - using console fallback for testing");
        }
        console.log("=".repeat(80));
        return;
    }
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
            console.error("❌ Resend error:", error);
            throw new Error("Resend failed");
        }
        console.log("✅ OTP email sent successfully via Resend to", email);
        console.log("📧 Email ID:", data?.id);
    }
    catch (error) {
        console.error("❌ Resend failed, trying alternative method...");
        try {
            const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    service_id: "default_service",
                    template_id: "template_id",
                    user_id: "user_id",
                    template_params: {
                        to_email: email,
                        otp: otp,
                    },
                }),
            });
            if (response.ok) {
                console.log("✅ OTP email sent successfully via EmailJS to", email);
                return;
            }
        }
        catch (emailjsError) {
            console.error("❌ EmailJS also failed:", emailjsError);
        }
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
        console.log("💡 For real email delivery, please set up a proper email service");
        console.log("=".repeat(80));
    }
};
exports.sendEmailOTP = sendEmailOTP;
//# sourceMappingURL=sendEmailOTP.js.map