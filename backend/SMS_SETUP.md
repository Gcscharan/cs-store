# SMS Setup Guide for Real-Time OTP Delivery

This guide will help you set up real-time SMS delivery for OTP authentication.

## Option 1: Twilio (Recommended - Global)

### Step 1: Create Twilio Account

1. Go to [https://www.twilio.com](https://www.twilio.com)
2. Sign up for a free account
3. Verify your phone number

### Step 2: Get Credentials

1. Go to [Twilio Console Dashboard](https://console.twilio.com/)
2. Find your **Account SID** and **Auth Token** on the dashboard
3. Go to **Phone Numbers** → **Manage** → **Buy a number**
4. Purchase a phone number (free trial includes $15 credit)

### Step 3: Configure Environment Variables

Add these to your `.env` file:

```env
TWILIO_ACCOUNT_SID=your-account-sid-here
TWILIO_AUTH_TOKEN=your-auth-token-here
TWILIO_PHONE_NUMBER=+1234567890
```

## Option 2: TextLocal (India Focused)

### Step 1: Create TextLocal Account

1. Go to [https://www.textlocal.in](https://www.textlocal.in)
2. Sign up for an account
3. Verify your email and phone

### Step 2: Get API Key

1. Go to **API** section in your dashboard
2. Generate an API key
3. Note your sender ID

### Step 3: Update Code (Alternative Implementation)

If you prefer TextLocal, replace the `sendSMS` function in `otpController.ts`:

```typescript
const sendSMS = async (phone: string, otp: string): Promise<void> => {
  try {
    const apiKey = process.env.TEXTLOCAL_API_KEY;
    const sender = process.env.TEXTLOCAL_SENDER_ID || "CSSTORE";

    if (!apiKey) {
      console.log(
        "⚠️  TextLocal API key not found, falling back to console logging"
      );
      console.log(`📱 SMS to ${phone}: Your OTP is ${otp}`);
      return;
    }

    const response = await fetch("https://api.textlocal.in/send/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apikey: apiKey,
        numbers: phone,
        message: `Your CS Store OTP is: ${otp}. Valid for 10 minutes.`,
        sender: sender,
      }),
    });

    const data = await response.json();

    if (data.status === "success") {
      console.log(`✅ SMS sent successfully to ${phone}`);
    } else {
      throw new Error(data.errors?.[0]?.message || "SMS sending failed");
    }
  } catch (error) {
    console.error("❌ Failed to send SMS:", error);
    console.log(`📱 SMS to ${phone}: Your OTP is ${otp} (SMS sending failed)`);
  }
};
```

Add to `.env`:

```env
TEXTLOCAL_API_KEY=your-textlocal-api-key
TEXTLOCAL_SENDER_ID=CSSTORE
```

## Option 3: AWS SNS (Advanced)

For production applications, AWS SNS provides reliable SMS delivery:

1. Create AWS account
2. Set up SNS service
3. Configure IAM credentials
4. Use AWS SDK to send SMS

## Testing

Once configured, test the SMS functionality:

1. Start the backend server
2. Try logging in with phone number: `9391795162`
3. Check your phone for the OTP message
4. Check backend console for delivery status

## Troubleshooting

### Common Issues:

1. **Invalid phone number format**: Ensure numbers include country code (+91 for India)
2. **Insufficient credits**: Check your Twilio/TextLocal account balance
3. **Rate limiting**: SMS services have rate limits for free accounts
4. **Phone number verification**: Some services require verified phone numbers

### Fallback Behavior:

If SMS sending fails, the system will:

1. Log the OTP to console
2. Continue with the authentication flow
3. Display appropriate error messages to user

## Cost Considerations

- **Twilio**: ~$0.0075 per SMS (free trial: $15 credit)
- **TextLocal**: ~₹0.15 per SMS (India)
- **AWS SNS**: ~$0.00645 per SMS (varies by region)

Choose based on your target audience and budget.
