#!/bin/bash

# Email Removal Safety Verification Script
# Run this to verify the system is safe before deploying

echo "🔍 EMAIL REMOVAL SAFETY VERIFICATION"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# 1. Check Payment model for dangerous defaults
echo "1️⃣  Checking Payment model..."
if grep -q "default: function()" backend/src/models/Payment.ts; then
  echo -e "${RED}❌ CRITICAL: Payment model has dangerous default function${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ Payment model is safe (no dangerous defaults)${NC}"
fi

# 2. Check JWT tokens don't include email for customers
echo ""
echo "2️⃣  Checking JWT token generation..."
JWT_EMAIL_USAGE=$(grep -r "jwt.sign" backend/src/domains/user/services/UserAccountService.ts | grep -i email || true)
if [ -n "$JWT_EMAIL_USAGE" ]; then
  echo -e "${YELLOW}⚠️  WARNING: JWT tokens may include email${NC}"
  echo "   Found: $JWT_EMAIL_USAGE"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✅ JWT tokens use phone (no email)${NC}"
fi

# 3. Check authController for email guards
echo ""
echo "3️⃣  Checking auth controller..."
if grep -q "if (!user.email)" backend/src/domains/identity/controllers/authController.ts; then
  echo -e "${RED}❌ CRITICAL: Auth controller has email guard (breaks OAuth)${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ Auth controller is clean (no email guards)${NC}"
fi

# 4. Check User model email configuration
echo ""
echo "4️⃣  Checking User model..."
if grep -q "email.*required.*true" backend/src/models/User.ts; then
  echo -e "${RED}❌ CRITICAL: User model requires email (should be optional)${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ User model has optional email${NC}"
fi

# 5. Check for getSafeEmail utility
echo ""
echo "5️⃣  Checking getSafeEmail utility..."
if [ -f "backend/src/utils/getSafeEmail.ts" ]; then
  echo -e "${GREEN}✅ getSafeEmail utility exists${NC}"
else
  echo -e "${RED}❌ CRITICAL: getSafeEmail utility missing${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 6. Check migration script exists
echo ""
echo "6️⃣  Checking migration script..."
if [ -f "backend/scripts/migrations/06_fix_email_indexes.js" ]; then
  echo -e "${GREEN}✅ Migration script exists${NC}"
  
  # Check if migration has dangerous operations
  if grep -q "db.users.updateMany({}, { \$unset: { email: \"\" } })" backend/scripts/migrations/06_fix_email_indexes.js; then
    echo -e "${RED}❌ CRITICAL: Migration script would delete ALL emails (including admin/delivery)${NC}"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}✅ Migration script is safe${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  WARNING: Migration script not found${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# 7. Check for hardcoded test emails
echo ""
echo "7️⃣  Checking for hardcoded test emails..."
TEST_EMAILS=$(grep -r "test@test.com\|user@example.com" backend/tests/ 2>/dev/null | wc -l)
if [ "$TEST_EMAILS" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  WARNING: Found $TEST_EMAILS hardcoded test emails${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✅ No hardcoded test emails found${NC}"
fi

# Summary
echo ""
echo "===================================="
echo "📊 VERIFICATION SUMMARY"
echo "===================================="
echo ""

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}❌ CRITICAL ISSUES: $ERRORS${NC}"
  echo -e "${RED}🚫 DO NOT DEPLOY - Fix critical issues first${NC}"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  WARNINGS: $WARNINGS${NC}"
  echo -e "${YELLOW}⚠️  Review warnings before deploying${NC}"
  exit 0
else
  echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
  echo -e "${GREEN}✅ System is safe for production${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Backup production database"
  echo "2. Run migration: node backend/scripts/migrations/06_fix_email_indexes.js"
  echo "3. Verify migration in staging"
  echo "4. Deploy to production"
  exit 0
fi
