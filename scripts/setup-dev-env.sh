#!/bin/bash

# CS Store Development Environment Setup Script
# This script creates the necessary environment files for development

echo "🚀 Setting up CS Store development environment..."

# Create backend .env file
cat > backend/.env << 'EOF'
# CS Store Backend Environment Variables
# Development configuration

# Database
MONGODB_URI=mongodb://localhost:27017/cps-store

# JWT Secrets (Development only - change in production)
JWT_SECRET=dev-jwt-secret-key-12345
JWT_REFRESH_SECRET=dev-refresh-secret-key-12345

# Razorpay Payment Gateway (Development - use test keys)
RAZORPAY_KEY_ID=rzp_test_1234567890
RAZORPAY_KEY_SECRET=test_secret_1234567890

# Cloudinary Image Storage (Development - use test account)
CLOUDINARY_CLOUD_NAME=test-cloud
CLOUDINARY_API_KEY=test-api-key
CLOUDINARY_API_SECRET=test-api-secret

# OAuth (Optional - will be disabled if not provided)
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret
# FACEBOOK_APP_ID=your-facebook-app-id
# FACEBOOK_APP_SECRET=your-facebook-app-secret

# Google Maps API (Optional)
# GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Sentry Error Tracking (Optional)
# SENTRY_DSN=your-sentry-dsn

# Server Configuration
PORT=5000
NODE_ENV=development
EOF

# Create frontend .env file
cat > frontend/.env << 'EOF'
# CS Store Frontend Environment Variables
# Development configuration

# Backend API URL
VITE_API_URL=http://localhost:5000

# Google Maps API Key (Optional)
# VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Sentry DSN (Optional)
# VITE_SENTRY_DSN=your-sentry-dsn

# Environment
VITE_NODE_ENV=development
EOF

echo "✅ Environment files created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Start MongoDB: mongod"
echo "2. Start backend: cd backend && npm run dev"
echo "3. Start frontend: cd frontend && npm run dev"
echo "4. Import test data: cd backend && npm run seed-all"
echo ""
echo "⚠️  Note: These are development environment files with test values."
echo "   For production, update the values in .env files with real API keys."
