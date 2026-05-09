#!/bin/bash

# Email Removal Safety Check Script
# Run this AFTER applying all email removal changes

echo "🔍 EMAIL REMOVAL SAFETY CHECK"
echo "============================="
echo ""

echo "1️⃣ Checking for remaining email usage in backend..."
echo ""

# Check for dangerous email patterns
echo "🚨 Checking for dangerous email patterns:"
echo ""

echo "   Checking user.email usage:"
grep -r "user\.email" backend/src/ | grep -v "getSafeEmail" | grep -v "// SAFE:" | head -5
echo ""

echo "   Checking req.body.email usage:"
grep -r "req\.body\.email" backend/src/ | grep -v "delivery" | grep -v "admin" | head -5
echo ""

echo "   Checking email: field usage:"
grep -r "email:" backend/src/ | grep -v "getSafeEmail" | grep -v "delivery" | grep -v "admin" | grep -v "models" | head -5
echo ""

echo "2️⃣ Checking JWT token generation..."
echo ""
grep -r "jwt\.sign" backend/src/ | grep "email" | head -3
echo ""

echo "3️⃣ Checking Payment model usage..."
echo ""
grep -r "userDetails.*email" backend/src/ | head -3
echo ""

echo "4️⃣ Checking test files..."
echo ""
grep -r "@test\.com" backend/tests/ | head -3
echo ""

echo "✅ EXPECTED RESULTS:"
echo "   - user.email should only appear in:"
echo "     * getSafeEmail utility"
echo "     * Delivery/admin auth"
echo "     * OAuth flows"
echo "   - JWT tokens should use phone, not email"
echo "   - Payment userDetails should use getSafeEmail()"
echo "   - Tests should not hardcode @test.com emails"
echo ""

echo "🎯 FINAL ARCHITECTURE VALIDATION:"
echo ""
echo "Customer Role: Phone OTP (email optional)"
echo "Delivery Role: Email + Password (email required)"
echo "Admin Role: Email + Password (email required)"
echo ""

echo "🚀 If all checks pass, system is SAFE FOR PRODUCTION"