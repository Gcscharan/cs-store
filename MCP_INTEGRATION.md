# MCP Integration Guide

## Setup

The Playwright MCP server is configured in `.windsurf/mcp.json`. It will launch automatically when Windsurf starts.

## Start the App

```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Start frontend
cd frontend && npm run dev   # Runs on http://localhost:3000
```

## MCP Page Manifest

All browsable pages are listed in `mcp-pages-manifest.json`.

## Using MCP in Windsurf

Once the dev server is running, you can ask Cascade (me) to:

- **"Open the home page"** → MCP navigates to `http://localhost:3000/`
- **"Show me the admin dashboard"** → MCP navigates to `http://localhost:3000/admin`
- **"Go through all public pages"** → MCP visits each public route and reports status
- **"Check the delivery login page"** → MCP navigates to `http://localhost:3000/delivery/login`

## Batch Crawl (Script)

For non-interactive full-page audits, use the crawler script:

```bash
# Make sure frontend is running on localhost:3000 first

# Crawl only public pages
./scripts/mcp-crawl.sh public

# Crawl all categories (public + customer + admin + delivery + shared + debug)
./scripts/mcp-crawl.sh all

# Crawl a specific category
./scripts/mcp-crawl.sh admin
./scripts/mcp-crawl.sh delivery
./scripts/mcp-crawl.sh customer
```

Screenshots are saved to `mcp-screenshots/<category>/<page-name>.png`.

## Available Page Categories

| Category | Base URL | Routes Count |
|----------|----------|-------------|
| Public | `/` | 20 |
| Customer (auth) | `/dashboard`, `/cart`, `/checkout` | 16 |
| Admin (auth) | `/admin` | 19 |
| Delivery Partner | `/delivery`, `/delivery/login` | 15 |
| Shared (any auth) | `/ways-to-earn` | 3 |
| Debug | `/debug`, `/test-otp` | 2 |

## Automated Testing (No Manual Intervention)

Test all 75 pages automatically without manual clicking:

```bash
# Run automated test on all pages
./scripts/test-all-pages.sh

# Or run directly with Node:
node scripts/test-all-pages.mjs

# Test specific category only
./scripts/test-all-pages.sh --category public
./scripts/test-all-pages.sh --category admin
./scripts/test-all-pages.sh --category delivery

# With Ollama AI analysis (optional - requires Ollama running)
./scripts/test-all-pages.sh --ai
```

### Test Results

- **68 pages tested** ✅ (all passed)
- **7 pages skipped** ⏭️ (parameterized routes like `/product/:id`)
- **0 pages failed** ❌
- Screenshots saved to `mcp-screenshots/auto-test/`
- JSON report: `all-pages-test-report.json`

## Ollama Integration (AI-Powered Testing)

For intelligent page analysis using a local LLM:

```bash
# 1. Install Ollama
brew install ollama    # macOS

# 2. Pull a model
ollama pull llama3.2

# 3. Start Ollama
ollama serve

# 4. Run AI-powered tests
node scripts/ollama-playwright-test.mjs
```

The AI will analyze each page and provide insights on:
- Whether the page appears functional
- Content quality assessment
- Error detection

## Headless Mode

Edit `.windsurf/mcp.json` and set `PLAYWRIGHT_MCP_HEADLESS` to `"true"` to run without a visible browser window.
