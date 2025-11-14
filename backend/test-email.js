// Direct test of Resend API - NO BULLSHIT
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx';

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING RESEND API - DIRECT TEST');
console.log('='.repeat(80));
console.log(`API Key: ${RESEND_API_KEY.substring(0, 10)}...`);

const resend = new Resend(RESEND_API_KEY);

const TEST_EMAIL = 'gcs.charan@gmail.com'; // Replace with your email

async function testEmail() {
  try {
    console.log(`\n📧 Sending test email to: ${TEST_EMAIL}`);
    console.log('⏳ Please wait...\n');

    const { data, error } = await resend.emails.send({
      from: 'CS Store <onboarding@resend.dev>',
      to: [TEST_EMAIL],
      subject: '🧪 TEST EMAIL - OTP System',
      html: `
        <div style="font-family: Arial; padding: 40px; background: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #667eea; text-align: center;">TEST EMAIL</h1>
            <p style="font-size: 18px; text-align: center; margin: 30px 0;">
              If you received this email, <strong>Resend API is working!</strong>
            </p>
            <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px; font-family: monospace;">
              TEST OTP: 999999
            </div>
            <p style="margin-top: 30px; color: #666; text-align: center;">
              Time: ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('='.repeat(80));
      console.error('❌ RESEND API ERROR');
      console.error('='.repeat(80));
      console.error('Error:', JSON.stringify(error, null, 2));
      console.error('='.repeat(80));
      
      if (error.message && error.message.includes('API key')) {
        console.error('\n🚨 API KEY IS INVALID!');
        console.error('Solution: Get a valid API key from https://resend.com/api-keys');
      }
      
      process.exit(1);
    }

    console.log('='.repeat(80));
    console.log('✅ EMAIL SENT SUCCESSFULLY VIA RESEND');
    console.log('='.repeat(80));
    console.log(`📧 To: ${TEST_EMAIL}`);
    console.log(`📨 Email ID: ${data.id}`);
    console.log(`⏰ Time: ${new Date().toLocaleString()}`);
    console.log('='.repeat(80));
    console.log('\n🎉 SUCCESS! Check your email inbox now!');
    console.log('📬 If not in inbox, check SPAM/PROMOTIONS folder\n');
    console.log('='.repeat(80) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('='.repeat(80));
    console.error('❌ FATAL ERROR');
    console.error('='.repeat(80));
    console.error(error);
    console.error('='.repeat(80) + '\n');
    process.exit(1);
  }
}

testEmail();
