# VyaparSetu Customer App

Expo-based React Native app for customers.

## Getting Started

```bash
# Install dependencies (from monorepo root)
npm install

# Start the app
cd apps/customer-app
npx expo start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR with Expo Go app on your phone

## Environment Variables

Copy `.env.example` to `.env` and fill in values:
- `EXPO_PUBLIC_API_URL` - Backend API URL
- `EXPO_PUBLIC_RAZORPAY_KEY_ID` - Razorpay key for payments
- `EXPO_PUBLIC_GOOGLE_MAPS_KEY` - Google Maps API key
