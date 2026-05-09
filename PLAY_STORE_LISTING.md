# VyaparSetu — Play Store Listing Assets

## App Details

**App Name:** VyaparSetu - Online Shopping  
**Package:** com.vyaparsetu.customer  
**Category:** Shopping  
**Content Rating:** Everyone

---

## Short Description (80 chars max)
```
Shop groceries & essentials. Fast delivery. UPI & COD accepted.
```

## Full Description (4000 chars max)
```
VyaparSetu brings your local market online — order groceries, daily essentials, 
and household items from the comfort of your home.

🛒 EASY SHOPPING
• Browse hundreds of products across categories
• Smart search with voice support
• Real-time stock availability
• Product images and detailed descriptions

💳 FLEXIBLE PAYMENTS
• Pay via Google Pay, PhonePe, Paytm, BHIM UPI
• Cash on Delivery available
• 100% secure & encrypted transactions
• Instant payment confirmation

🚚 FAST DELIVERY
• Real-time order tracking
• Live delivery partner location
• Estimated delivery time shown upfront
• Delivery to your exact address

📦 ORDER MANAGEMENT
• Track every step: Confirmed → Packed → Out for Delivery → Delivered
• Push notifications for every status update
• Order history and re-order in one tap
• Easy cancellation before dispatch

🎁 SAVINGS & OFFERS
• Smart coupon suggestions based on your cart
• Free delivery above minimum order value
• Regular deals and discounts

🔒 SAFE & SECURE
• OTP-based login — no password needed
• Secure payment processing
• Your data is never shared

Download VyaparSetu today and experience the convenience of online shopping 
with the trust of your local market!
```

---

## Screenshots Required (Play Store)
Upload 2–8 screenshots per device type. Recommended sizes:
- Phone: 1080 × 1920 px (portrait)
- 7-inch tablet: 1200 × 1920 px
- 10-inch tablet: 1600 × 2560 px

### Screens to capture:
1. **Home screen** — product grid with categories
2. **Product detail** — product image, price, add to cart
3. **Cart** — items, total, checkout button
4. **Checkout / Payment** — UPI apps, COD option, address
5. **Order tracking** — live status with timeline
6. **Order history** — list of past orders
7. **Push notification** — order confirmed notification

---

## Feature Graphic
- Size: 1024 × 500 px
- Content: App logo + tagline "Your Local Market, Online"
- Background: Orange gradient (#f97316 → #ea580c)

---

## App Icon
- Already configured: `apps/customer-app/assets/icon.png`
- Adaptive icon: `apps/customer-app/assets/adaptive-icon.png`
- Background color: #f97316 (orange)

---

## Build & Submit Commands

### Step 1: Build production AAB
```bash
cd apps/customer-app
eas build --platform android --profile production
```

### Step 2: Submit to Play Store (internal testing track)
```bash
# First: download google-play-service-account.json from Google Play Console
# Place it at: apps/customer-app/google-play-service-account.json
eas submit --platform android --profile production
```

### Step 3: Manual submission checklist
- [ ] Upload AAB to Play Console → Internal testing
- [ ] Add testers (email addresses)
- [ ] Fill in store listing (use copy above)
- [ ] Upload screenshots (7 screens listed above)
- [ ] Upload feature graphic (1024×500)
- [ ] Set content rating (Everyone)
- [ ] Set pricing (Free)
- [ ] Submit for review

---

## Play Console Setup (one-time)
1. Go to https://play.google.com/console
2. Create new app → Android → Free → Not containing ads
3. Complete all required sections in the dashboard
4. Set up internal testing track first
5. Add your test device's Gmail to testers list

---

## Privacy Policy URL (required)
Host a privacy policy page. Minimum content:
- What data you collect (phone number, location, order history)
- How you use it (order fulfillment, delivery)
- Third parties (Razorpay for payments, Expo for push notifications)
- Contact email for data requests

Example URL: `https://vyaparsetu.com/privacy`
