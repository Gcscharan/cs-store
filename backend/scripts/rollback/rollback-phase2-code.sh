#!/bin/bash
###############################################################################
# Rollback Script: Phase 2 - Code Changes
#
# This script reverts the code changes made in Phase 2 of the payment
# idempotency fixes.
#
# WHAT IT DOES:
# - Reverts to the previous git commit (before Phase 2)
# - Rebuilds the application
# - Restarts the backend service
#
# WHEN TO USE:
# - If Phase 2 deployment causes errors
# - If duplicate orders are detected
# - If performance degrades significantly
# - If payment finalization starts failing
#
# SAFETY:
# - Creates a backup tag before reverting
# - Preserves schema changes (backward compatible)
# - Can be re-deployed after fixing issues
#
# USAGE:
#   bash backend/scripts/rollback/rollback-phase2-code.sh
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_TAG="backup-before-phase2-rollback-$(date +%Y%m%d-%H%M%S)"
ROLLBACK_COMMIT="${ROLLBACK_COMMIT:-HEAD~1}"  # Default: previous commit

echo -e "${BLUE}🔄 Payment Idempotency Rollback - Phase 2 (Code Changes)${NC}\n"

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: Must be run from backend directory${NC}"
  exit 1
fi

# Check if git is available
if ! command -v git &> /dev/null; then
  echo -e "${RED}❌ Error: git is not installed${NC}"
  exit 1
fi

# Show current commit
echo -e "${BLUE}📋 Current commit:${NC}"
git log -1 --oneline
echo ""

# Show rollback target
echo -e "${BLUE}📋 Rollback target:${NC}"
git log -1 --oneline "$ROLLBACK_COMMIT"
echo ""

# Confirm rollback
echo -e "${YELLOW}⚠️  WARNING: This will rollback Phase 2 code changes${NC}"
echo "   - Revert to commit: $ROLLBACK_COMMIT"
echo "   - Rebuild application"
echo "   - Restart backend service"
echo ""
read -p "Do you want to proceed? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo -e "${RED}❌ Rollback cancelled${NC}"
  exit 0
fi

echo -e "${BLUE}🔄 Starting rollback...${NC}\n"

# Step 1: Create backup tag
echo -e "${BLUE}1️⃣  Creating backup tag: $BACKUP_TAG${NC}"
git tag "$BACKUP_TAG"
echo -e "${GREEN}✅ Created backup tag${NC}"

# Step 2: Stash any uncommitted changes
echo -e "\n${BLUE}2️⃣  Stashing uncommitted changes...${NC}"
if git diff-index --quiet HEAD --; then
  echo -e "${GREEN}ℹ️  No uncommitted changes${NC}"
else
  git stash save "Rollback Phase 2 - $(date +%Y%m%d-%H%M%S)"
  echo -e "${GREEN}✅ Stashed uncommitted changes${NC}"
fi

# Step 3: Revert to previous commit
echo -e "\n${BLUE}3️⃣  Reverting to commit: $ROLLBACK_COMMIT${NC}"
git reset --hard "$ROLLBACK_COMMIT"
echo -e "${GREEN}✅ Reverted to previous commit${NC}"

# Step 4: Install dependencies
echo -e "\n${BLUE}4️⃣  Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 5: Build application
echo -e "\n${BLUE}5️⃣  Building application...${NC}"
npm run build
echo -e "${GREEN}✅ Application built${NC}"

# Step 6: Restart backend service
echo -e "\n${BLUE}6️⃣  Restarting backend service...${NC}"

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
  echo "Using PM2..."
  pm2 reload backend || pm2 restart backend
  echo -e "${GREEN}✅ Backend restarted with PM2${NC}"
elif command -v systemctl &> /dev/null; then
  echo "Using systemctl..."
  sudo systemctl restart backend
  echo -e "${GREEN}✅ Backend restarted with systemctl${NC}"
else
  echo -e "${YELLOW}⚠️  Could not detect process manager${NC}"
  echo "Please restart the backend service manually"
fi

# Step 7: Verify deployment
echo -e "\n${BLUE}7️⃣  Verifying deployment...${NC}"
sleep 5  # Wait for service to start

# Check if backend is responding
if command -v curl &> /dev/null; then
  HEALTH_URL="${HEALTH_URL:-http://localhost:3000/health}"
  echo "Checking health endpoint: $HEALTH_URL"
  
  if curl -f -s "$HEALTH_URL" > /dev/null; then
    echo -e "${GREEN}✅ Backend is responding${NC}"
  else
    echo -e "${YELLOW}⚠️  Backend health check failed${NC}"
    echo "Please check logs manually"
  fi
else
  echo -e "${YELLOW}ℹ️  curl not available, skipping health check${NC}"
fi

# Show final status
echo -e "\n${GREEN}✅ Phase 2 rollback completed successfully!${NC}"
echo ""
echo -e "${BLUE}📝 Next steps:${NC}"
echo "   1. Check backend logs:"
echo "      pm2 logs backend --lines 50"
echo "      # or"
echo "      tail -f /var/log/backend.log"
echo ""
echo "   2. Verify order creation works:"
echo "      curl -X POST http://localhost:3000/api/orders/create \\"
echo "        -H 'Authorization: Bearer <token>' \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"paymentMethod\":\"UPI\"}'"
echo ""
echo "   3. Monitor metrics dashboard"
echo ""
echo "   4. Check for duplicate orders:"
echo "      node backend/scripts/verify-no-duplicate-orders.js"
echo ""
echo -e "${BLUE}📌 Backup tag created: $BACKUP_TAG${NC}"
echo "   To restore Phase 2 code:"
echo "   git reset --hard $BACKUP_TAG"
