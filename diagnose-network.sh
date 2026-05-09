#!/bin/bash

echo "🔍 Network Connectivity Diagnostic Tool"
echo "========================================"
echo ""

# Get laptop IP
LAPTOP_IP=$(ifconfig | grep -A 1 "en0" | grep "inet " | awk '{print $2}')
echo "✅ Laptop IP: $LAPTOP_IP"

# Get router IP
ROUTER_IP=$(netstat -nr | grep default | awk '{print $2}' | head -1)
echo "✅ Router IP: $ROUTER_IP"

# Get hostname
HOSTNAME=$(hostname)
echo "✅ Hostname: $HOSTNAME"

echo ""
echo "📋 Current Configuration:"
echo "------------------------"
echo "Backend API: http://$LAPTOP_IP:9000/api"
echo "Backend Health: http://$LAPTOP_IP:9000/health"
echo "Router Admin: http://$ROUTER_IP"
echo ""

# Test if backend is running
echo "🧪 Testing backend server..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/health | grep -q "200"; then
    echo "✅ Backend is running on localhost"
else
    echo "❌ Backend is NOT running on localhost"
    echo "   Run: cd backend && npm run dev"
    exit 1
fi

# Test if backend is accessible via network IP
echo ""
echo "🧪 Testing backend accessibility via network IP..."
if curl -s -o /dev/null -w "%{http_code}" http://$LAPTOP_IP:9000/health | grep -q "200"; then
    echo "✅ Backend is accessible via $LAPTOP_IP"
else
    echo "❌ Backend is NOT accessible via $LAPTOP_IP"
    echo "   This might be a firewall issue"
fi

echo ""
echo "📱 Mobile App Configuration:"
echo "----------------------------"
if [ -f "apps/customer-app/.env" ]; then
    echo "Current .env:"
    cat apps/customer-app/.env
else
    echo "❌ .env file not found"
fi

echo ""
echo "🔧 Next Steps:"
echo "-------------"
echo "1. Open phone browser and test: http://$LAPTOP_IP:9000/health"
echo ""
echo "   ✅ If it works: AP Isolation is disabled, restart Expo"
echo "   ❌ If it fails: AP Isolation is enabled, follow FIX_NETWORK_ISSUE.md"
echo ""
echo "2. To disable AP Isolation:"
echo "   - Open browser: http://$ROUTER_IP"
echo "   - Login to router"
echo "   - Find 'AP Isolation' setting"
echo "   - Disable it"
echo "   - Save and restart router"
echo ""
echo "3. After fixing, restart Expo:"
echo "   cd apps/customer-app"
echo "   npx expo start -c"
echo ""
echo "📄 Full guide: See FIX_NETWORK_ISSUE.md"
