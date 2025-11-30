import fs from "fs";
import path from "path";

// Create .env.test file with mock configurations
const testEnvPath = path.join(__dirname, "../../.env.test");
const testEnvContent = `
# Test Environment Configuration
NODE_ENV=test
PORT=5002
MONGODB_URI=mongodb://127.0.0.1:27017/cs-store-test

# JWT Secrets (test values)
JWT_SECRET=test-jwt-secret-key
JWT_REFRESH_SECRET=test-jwt-refresh-secret-key

# Mock OTP (bypasses SMS providers)
MOCK_OTP=true

# Redis (test database)
REDIS_URL=redis://localhost:6379/1

# Razorpay (test mode)
RAZORPAY_KEY_ID=rzp_test_testkey
RAZORPAY_KEY_SECRET=test_secret

# Cloudinary (disabled in tests)
CLOUDINARY_CLOUD_NAME=test
CLOUDINARY_API_KEY=test
CLOUDINARY_API_SECRET=test

# Google OAuth (test values)
GOOGLE_CLIENT_ID=test-client-id
GOOGLE_CLIENT_SECRET=test-client-secret

# Email (disabled in tests)
RESEND_API_KEY=test
SMTP_HOST=test
SMTP_PORT=587
SMTP_USER=test
SMTP_PASS=test

# SMS (disabled in tests)
FAST2SMS_API_KEY=test
FAST2SMS_SENDER_ID=TEST
TWILIO_ACCOUNT_SID=test
TWILIO_AUTH_TOKEN=test
TWILIO_PHONE_NUMBER=test

# Google Maps (disabled in tests)
GOOGLE_MAPS_API_KEY=test
`;

// Write test environment file
fs.writeFileSync(testEnvPath, testEnvContent.trim());

console.log("✅ Test environment configured with mocks");
console.log(`📝 Created .env.test at: ${testEnvPath}`);
console.log("\n🔧 Mock configurations enabled:");
console.log("- MOCK_OTP=true (bypasses SMS providers)");
console.log("- Redis: test database (DB 1)");
console.log("- Razorpay: test keys");
console.log("- Cloudinary: disabled");
console.log("- Email: disabled");
console.log("- SMS: disabled");
console.log("- Google Maps: disabled");
console.log("\n🚀 Run tests with: npm run test");
console.log("📊 Run coverage with: npm run test:coverage");
