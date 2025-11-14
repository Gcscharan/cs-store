#!/bin/bash
# Quick script to restart frontend with cache clearing

echo "🛑 Stopping frontend server..."
pkill -f "react-scripts start" || true
pkill -f "vite" || true
sleep 2

echo "🗑️  Clearing build cache..."
cd /Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/frontend
rm -rf node_modules/.cache
rm -rf .vite
rm -rf build
rm -rf dist

echo "🚀 Starting frontend server..."
npm run dev &

echo ""
echo "✅ Frontend restarting..."
echo ""
echo "⚠️  IMPORTANT: In your browser, do a HARD REFRESH:"
echo "   • Chrome/Edge: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)"
echo "   • Or open DevTools → right-click reload → 'Empty Cache and Hard Reload'"
echo ""
