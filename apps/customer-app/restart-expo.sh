#!/bin/bash

# Stop any running Expo processes
echo "🛑 Stopping any running Expo processes..."
pkill -f "expo start" || true
pkill -f "metro" || true

# Clear Expo cache
echo "🧹 Clearing Expo cache..."
npx expo start -c --clear

echo "✅ Expo restarted with clean cache!"
echo ""
echo "📱 Next steps:"
echo "1. Wait for QR code to appear"
echo "2. Press 'a' to rebuild on Android"
echo "3. Or scan the QR code with Expo Go"
