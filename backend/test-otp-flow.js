// Test the actual OTP login flow
const axios = require('axios');

const BASE_URL = 'http://localhost:5001';
const TEST_EMAIL = 'gcs.charan@gmail.com';

async function testOTPFlow() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING ACTUAL OTP LOGIN FLOW');
  console.log('='.repeat(80) + '\n');

  try {
    // Step 1: Send OTP
    console.log('Step 1: Sending OTP request...');
    console.log(`Email: ${TEST_EMAIL}\n`);

    const sendResponse = await axios.post(`${BASE_URL}/api/auth/send-otp`, {
      email: TEST_EMAIL
    });

    console.log('='.repeat(80));
    console.log('✅ OTP SEND REQUEST SUCCESSFUL');
    console.log('='.repeat(80));
    console.log('Response:', JSON.stringify(sendResponse.data, null, 2));
    console.log('='.repeat(80) + '\n');

    console.log('🎉 SUCCESS!');
    console.log('📧 Check your email: ' + TEST_EMAIL);
    console.log('📬 Check SPAM folder if not in inbox');
    console.log('🔑 Also check backend server console for the OTP\n');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('='.repeat(80));
    console.error('❌ ERROR IN OTP FLOW');
    console.error('='.repeat(80));
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 404) {
        console.error('\n🚨 USER NOT FOUND!');
        console.error(`Email ${TEST_EMAIL} is not registered.`);
        console.error('Solution: Sign up first at http://localhost:3000/signup');
      }
    } else {
      console.error('Error:', error.message);
      console.error('\n🚨 POSSIBLE ISSUES:');
      console.error('- Backend server not running?');
      console.error('- Check if server is on port 5001');
    }
    console.error('='.repeat(80) + '\n');
  }
}

testOTPFlow();
