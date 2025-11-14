# UPI ID Verification Implementation

## 🎯 Overview

This implementation provides a robust UPI ID verification system using Razorpay's VPA validation API with comprehensive error handling, rate limiting, and security measures.

## 🏗️ Architecture

### Backend (Node.js + Express + TypeScript)

- **Route**: `POST /api/payment/verify-upi`
- **Controller**: `src/controllers/upiController.ts`
- **Rate Limiting**: 5 requests per minute per IP
- **Security**: Input validation, error logging, timeout handling

### Frontend (React + TypeScript)

- **Integration**: Real-time UPI verification in checkout page
- **UI**: Dynamic validation feedback with holder name display
- **Error Handling**: User-friendly error messages

## 📋 API Specification

### Request

```http
POST /api/payment/verify-upi
Content-Type: application/json

{
  "vpa": "user@okaxis"
}
```

### Response

#### Success (200)

```json
{
  "success": true,
  "name": "GANNAVARAPU SATYA CHARAN"
}
```

#### Error (400)

```json
{
  "success": false,
  "message": "Invalid UPI ID"
}
```

#### Rate Limited (429)

```json
{
  "success": false,
  "message": "Too many UPI verification attempts. Please try again later."
}
```

## 🔧 Implementation Details

### Backend Features

1. **Input Validation**

   - UPI ID format validation
   - Empty/null check
   - Length validation (5-50 characters)

2. **Rate Limiting**

   - 5 requests per minute per IP
   - Prevents abuse and spam

3. **Error Handling**

   - Razorpay API timeout (5 seconds)
   - Authentication errors
   - Network errors
   - Comprehensive logging

4. **Security**
   - No sensitive data in logs
   - Proper error responses
   - Input sanitization

### Frontend Features

1. **Real-time Validation**

   - Instant feedback on UPI ID format
   - Visual indicators (red/green borders)
   - Dynamic error messages

2. **User Experience**

   - Loading states during verification
   - Success/error toasts
   - Holder name display after verification

3. **Integration**
   - Seamless checkout flow
   - Payment button state management
   - Error recovery

## 🚀 Usage

### Backend Setup

1. **Environment Variables**

   ```bash
   RAZORPAY_KEY_ID=your-razorpay-key-id
   RAZORPAY_KEY_SECRET=your-razorpay-key-secret
   ```

2. **Dependencies**

   ```bash
   npm install axios express-rate-limit
   ```

3. **Route Registration**
   ```typescript
   app.use("/api/payment", paymentRoutes);
   ```

### Frontend Integration

1. **API Call**

   ```typescript
   const response = await fetch("/api/payment/verify-upi", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ vpa: upiId }),
   });
   ```

2. **Response Handling**
   ```typescript
   const data = await response.json();
   if (data.success) {
     setUpiHolderName(data.name);
   } else {
     toast.error(data.message);
   }
   ```

## 🧪 Testing

### Test Cases

1. **Valid UPI IDs**

   - `gcs@okaxis` → "GANNAVARAPU SATYA CHARAN"
   - `user@okaxis` → "John Doe"
   - `test@okaxis` → "Test User"

2. **Invalid UPI IDs**

   - `invalid@upi` → "Invalid UPI ID"
   - Empty string → "UPI ID required"
   - `notanupi` → "Invalid UPI ID format"

3. **Rate Limiting**
   - 6 requests in 1 minute → Rate limited

### Manual Testing

```bash
# Valid UPI
curl -X POST http://localhost:5001/api/payment/verify-upi \
  -H "Content-Type: application/json" \
  -d '{"vpa":"gcs@okaxis"}'

# Invalid UPI
curl -X POST http://localhost:5001/api/payment/verify-upi \
  -H "Content-Type: application/json" \
  -d '{"vpa":"invalid@upi"}'
```

## 🔄 Production Setup

### Real Razorpay Integration

1. **Uncomment Real API Call**

   ```typescript
   // In upiController.ts, uncomment the Razorpay API call section
   ```

2. **Add Real Credentials**

   ```bash
   RAZORPAY_KEY_ID=rzp_live_xxxxx
   RAZORPAY_KEY_SECRET=your_live_secret
   ```

3. **Remove Mock Data**
   ```typescript
   // Remove the mockUpiData object
   ```

### Security Considerations

1. **Environment Variables**

   - Never commit `.env` files
   - Use secure key management
   - Rotate keys regularly

2. **Rate Limiting**

   - Adjust limits based on usage
   - Monitor for abuse
   - Consider per-user limits

3. **Logging**
   - Log failed attempts
   - Monitor error rates
   - Set up alerts

## 📊 Monitoring

### Key Metrics

- Verification success rate
- Error rate by type
- Rate limit hits
- Response times

### Logs

- Successful verifications
- Failed attempts with reasons
- Rate limit violations
- System errors

## 🐛 Troubleshooting

### Common Issues

1. **"Server error" response**

   - Check Razorpay credentials
   - Verify environment variables
   - Check server logs

2. **Rate limiting too aggressive**

   - Adjust `max` value in rate limiter
   - Consider per-user limits

3. **UPI ID not found**
   - Verify UPI ID format
   - Check Razorpay test/live mode
   - Ensure UPI ID is registered

### Debug Steps

1. Check server logs
2. Verify environment variables
3. Test with known valid UPI IDs
4. Check network connectivity to Razorpay

## 📝 Notes

- Currently using mock data for demonstration
- Real Razorpay integration is commented out
- Rate limiting is set to 5 requests/minute
- All error cases are properly handled
- Frontend integration is complete and working

## 🔗 Related Files

- `backend/src/controllers/upiController.ts` - Main controller
- `backend/src/routes/paymentRoutes.js` - Route registration
- `frontend/src/pages/CheckoutPage.tsx` - Frontend integration
- `backend/env.template` - Environment variables template
