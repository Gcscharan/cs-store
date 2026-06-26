#!/bin/bash
# Automated Page Testing with optional Ollama AI analysis
#
# Usage:
#   ./scripts/test-all-pages.sh [options]
#
# Options:
#   --category <name>  Test specific category (public, admin, customer, delivery, all)
#   --ai              Enable Ollama AI analysis (requires Ollama running)
#   --headed          Run browser in visible mode (slower but watchable)
#   --port <num>      Frontend port (default: 3000)
#
# Examples:
#   ./scripts/test-all-pages.sh                    # Test all pages
#   ./scripts/test-all-pages.sh --category public  # Test only public pages
#   ./scripts/test-all-pages.sh --ai               # Test with AI analysis

set -e

CATEGORY="all"
USE_AI=""
HEADED=""
PORT="3000"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --category)
      CATEGORY="$2"
      shift 2
      ;;
    --ai)
      USE_AI="--ai"
      shift
      ;;
    --headed)
      HEADED="--headed"
      shift
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

export FRONTEND_URL="http://localhost:${PORT}"

echo "🤖 Automated Page Testing"
echo "=========================="
echo "Target: ${FRONTEND_URL}"
echo "Category: ${CATEGORY}"
if [ -n "$USE_AI" ]; then
  echo "AI Analysis: Enabled (Ollama)"
fi
echo ""

# Check if frontend is running
echo "Checking frontend..."
if ! curl -s --connect-timeout 3 -o /dev/null -w "%{http_code}" "${FRONTEND_URL}" | grep -q "200\|301"; then
  echo "❌ Frontend not responding at ${FRONTEND_URL}"
  echo "   Start it: cd frontend && npm run dev -- --port ${PORT}"
  exit 1
fi
echo "✅ Frontend is running"
echo ""

# Check Ollama if AI mode
if [ -n "$USE_AI" ]; then
  echo "Checking Ollama..."
  if curl -s --connect-timeout 2 "http://localhost:11434/api/tags" > /dev/null 2>&1; then
    echo "✅ Ollama is running"
  else
    echo "⚠️  Ollama not detected"
    echo "   Install: https://ollama.com/download"
    echo "   Then run: ollama pull llama3.2"
    echo "   Continuing without AI analysis..."
    USE_AI=""
  fi
  echo ""
fi

# Run the test
echo "Starting automated tests..."
echo ""

cd "$(dirname "$0")/.."

if [ -n "$USE_AI" ]; then
  node scripts/ollama-playwright-test.mjs "${CATEGORY}" --ai
else
  node scripts/test-all-pages.mjs
fi
