#!/bin/bash
# MCP Page Crawler — navigates all pages and captures screenshots
#
# Usage:
#   ./scripts/mcp-crawl.sh [category]
#
# Examples:
#   ./scripts/mcp-crawl.sh public
#   ./scripts/mcp-crawl.sh admin
#   ./scripts/mcp-crawl.sh all

set -e

CATEGORY="${1:-public}"
BASE_URL="http://localhost:3000"

echo "🚀 MCP Page Crawler"
echo "   Category: $CATEGORY"
echo "   URL: $BASE_URL"

# Check if dev server is running
if ! curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|301\|302"; then
  echo "⚠️  Frontend not responding at $BASE_URL"
  echo "   Start it first: cd frontend && npm run dev"
  exit 1
fi

# Run crawler
npx ts-node scripts/mcp-crawl-pages.ts "$CATEGORY"
